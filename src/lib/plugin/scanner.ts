import { existsSync, readdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { getRoutePath, requiresSafeAccess } from './helpers.js';
import { readFileContent } from './shared-utils.js';

// Types
export interface ViteConfig {
	alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
	resolve?: {
		alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
	};
}

export interface SvelteKitConfig {
	kit?: {
		alias?: Record<string, string>;
	};
}

// Constants
const TRANSLATION_IMPORT_PATTERNS = [
	/import\s+\{[^}]*\}\s+from\s+['"]@i18n['"]/g, // import { t } from '@i18n'
	/import\s+\*\s+as\s+\w+\s+from\s+['"]@i18n['"]/g // import * as t from '@i18n'
] as const;

const TRANSLATION_USAGE_PATTERNS = [
	/\bt\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/g, // t.hello()
	/\bt\[['"]([^'"]+)['"]\]\s*\(/g, // t['user-count']() or t['continue']()
	/\bdata\._loadedTranslations\.([a-zA-Z][a-zA-Z0-9]*)\b/g, // data._loadedTranslations.hello
	/\bdata\._loadedTranslations\[['"]([^'"]+)['"]\]/g, // data._loadedTranslations['user-count'] or data._loadedTranslations['continue']
	/\bt\.([a-zA-Z][a-zA-Z0-9]*Fn)\s*\(/g, // t.continueFn() - reserved words with Fn suffix
	/\bdata\._loadedTranslations\.([a-zA-Z][a-zA-Z0-9]*Fn)\b/g // data._loadedTranslations.continueFn
] as const;

const DIRECT_FUNCTION_PATTERN = /\b([a-zA-Z][a-zA-Z0-9]*)\s*\(/g; // hello(), welcome(), etc.

const IMPORT_PATTERNS = [
	/import\s+(\w+)\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import Component from './Component.svelte'
	/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import { Component } from './Component.svelte'
	/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import * as Components from './Component.svelte'
	/import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import Component, { Other } from './Component.svelte'
	/import\s+\{([^}]+)\}\s*,\s*(\w+)\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import { Component } from './Component.svelte'
	// Add patterns for @ prefixed aliases without .svelte extension
	/import\s+(\w+)\s+from\s+['"](@[^'"]+)['"]/g, // import Component from '@alias'
	/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](@[^'"]+)['"]/g, // import { Component } from '@alias'
	/import\s+\*\s+as\s+\w+\s+from\s+['"](@[^'"]+)['"]/g // import * as Components from '@alias'
] as const;

const DYNAMIC_IMPORT_PATTERNS = [
	/import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // import('Component.svelte')
	/await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // await import('Component.svelte')
	/const\s+\w+\s*=\s*await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // const c = await import('Component.svelte')
	/let\s+\w+\s*=\s*await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // let c = await import('Component.svelte')
	/var\s+\w+\s*=\s*await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // var c = await import('Component.svelte')
	/=\s*import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // = import('Component.svelte')
	/import\s*\(\s*`([^`]+\.svelte)`\s*\)/g, // import(`Component.svelte`)
	/await\s+import\s*\(\s*`([^`]+\.svelte)`\s*\)/g // await import(`Component.svelte`)
] as const;

const ROUTE_FILES = {
	PAGE: '+page.svelte',
	LAYOUT: '+layout.svelte',
	PAGE_SERVER: '+page.server.ts',
	LAYOUT_SERVER: '+layout.server.ts'
} as const;

// Global variable to store Vite config for alias resolution
let globalViteConfig: ViteConfig = {};
let globalSvelteKitConfig: SvelteKitConfig = {};

/**
 * Set Vite config for alias resolution
 */
export function setViteConfig(config: ViteConfig): void {
	globalViteConfig = config;
}

/**
 * Set SvelteKit config for alias resolution
 */
export function setSvelteKitConfig(config: SvelteKitConfig): void {
	globalSvelteKitConfig = config;
}

/**
 * Resolve import alias using Vite config
 */
function resolveAlias(importPath: string): string {
	// Check if it's an alias that needs resolution
	if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('/')) {
		return importPath; // Not an alias
	}

	// Handle built-in SvelteKit aliases first
	if (importPath.startsWith('$lib/')) {
		return importPath.replace('$lib/', 'src/lib/');
	}
	if (importPath.startsWith('$app/')) {
		return importPath.replace('$app/', 'src/app/');
	}
	if (importPath.startsWith('$env/')) {
		return importPath.replace('$env/', 'src/env/');
	}
	if (importPath.startsWith('$components/')) {
		return importPath.replace('$components/', 'src/components/');
	}

	// Get aliases from Vite config
	const viteAliases = globalViteConfig.alias || globalViteConfig.resolve?.alias;

	// Get aliases from SvelteKit config
	const svelteKitAliases = globalSvelteKitConfig.kit?.alias;

	// Combine both alias sources
	const allAliases: Record<string, string> = {};

	// Add SvelteKit aliases first (they take precedence)
	if (svelteKitAliases) {
		Object.assign(allAliases, svelteKitAliases);
	}

	// Add Vite aliases
	if (viteAliases) {
		// Handle array format: [{ find: '@variants', replacement: 'src/variants' }]
		if (Array.isArray(viteAliases)) {
			for (const alias of viteAliases) {
				if (typeof alias.find === 'string') {
					allAliases[alias.find] = alias.replacement;
				}
			}
		}
		// Handle object format: { '@variants': 'src/variants' }
		else if (typeof viteAliases === 'object') {
			Object.assign(allAliases, viteAliases);
		}
	}

	// Resolve aliases
	for (const [alias, replacement] of Object.entries(allAliases)) {
		if (importPath.startsWith(alias)) {
			const resolvedPath = importPath.replace(alias, replacement);
			// If the replacement is a relative path, make it absolute from project root
			if (resolvedPath.startsWith('./') || resolvedPath.startsWith('../')) {
				return resolve(process.cwd(), resolvedPath);
			}
			return resolvedPath;
		}
	}

	return importPath;
}

// Types
export interface PageTranslationUsage {
	pageFile: string;
	serverFile: string;
	usedKeys: Set<string>;
	routePath: string;
}

interface RouteFile {
	filePath: string;
	serverFile: string;
	routePath: string;
	isLayout: boolean;
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
	return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Add key variants to set
 */
function addKeyVariants(usedKeys: Set<string>, key: string): void {
	usedKeys.add(key);

	// Handle reserved words with Fn suffix - extract original key
	if (key.endsWith('Fn')) {
		const originalKey = key.slice(0, -2); // Remove 'Fn' suffix
		if (requiresSafeAccess(originalKey)) {
			usedKeys.add(originalKey);

			// Also add kebab-case variant of original key
			const kebabOriginal = camelToKebab(originalKey);
			if (kebabOriginal !== originalKey) {
				usedKeys.add(kebabOriginal);
			}
		}
	}

	// Convert camelCase back to kebab-case to find original key
	const kebabKey = camelToKebab(key);
	if (kebabKey !== key) {
		usedKeys.add(kebabKey);
	}
}

/**
 * Check if file has translation import
 */
function hasTranslationImport(content: string): boolean {
	return TRANSLATION_IMPORT_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Extract translation keys from content using patterns
 */
/**
 * Check if a position in content is inside a comment
 */
function isInComment(content: string, position: number): boolean {
	const beforePosition = content.substring(0, position);

	// Check for HTML comments <!-- -->
	const lastHtmlCommentStart = beforePosition.lastIndexOf('<!--');
	const lastHtmlCommentEnd = beforePosition.lastIndexOf('-->');
	if (
		lastHtmlCommentStart !== -1 &&
		(lastHtmlCommentEnd === -1 || lastHtmlCommentStart > lastHtmlCommentEnd)
	) {
		return true; // Inside HTML comment
	}

	// Check for JSX comments {/* */}
	const lastJsxCommentStart = beforePosition.lastIndexOf('{/*');
	const lastJsxCommentEnd = beforePosition.lastIndexOf('*/}');
	if (
		lastJsxCommentStart !== -1 &&
		(lastJsxCommentEnd === -1 || lastJsxCommentStart > lastJsxCommentEnd)
	) {
		return true; // Inside JSX comment
	}

	// Check for line comments //
	const lines = beforePosition.split('\n');
	const currentLine = lines[lines.length - 1];
	if (currentLine.includes('//')) {
		const commentStart = currentLine.indexOf('//');
		const matchStart = position - currentLine.length;
		if (matchStart >= commentStart) {
			return true; // Inside line comment
		}
	}

	return false;
}

function extractTranslationKeys(content: string, hasDirectImports: boolean): Set<string> {
	const usedKeys = new Set<string>();

	// Use all standard patterns
	const patterns = [...TRANSLATION_USAGE_PATTERNS];

	// Add direct function pattern if file imports translations
	if (hasDirectImports) {
		// Extract keys from direct function pattern, but filter out import-related matches
		let match;
		while ((match = DIRECT_FUNCTION_PATTERN.exec(content)) !== null) {
			const key = match[1];

			// Skip if this looks like an import statement (t from '@i18n')
			const beforeMatch = content.substring(0, match.index);
			const lastImportIndex = beforeMatch.lastIndexOf('import');
			if (lastImportIndex !== -1) {
				const importLine = content.substring(lastImportIndex, match.index + match[0].length);
				if (importLine.includes('from') && importLine.includes('@i18n')) {
					continue; // Skip this match as it's from an import statement
				}
			}

			// Skip if this is inside a comment
			if (isInComment(content, match.index)) {
				continue;
			}

			addKeyVariants(usedKeys, key);
		}
	}

	// Extract keys from standard patterns
	patterns.forEach((pattern) => {
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const key = match[1];

			// Skip if this is inside a comment
			if (isInComment(content, match.index)) {
				continue;
			}

			addKeyVariants(usedKeys, key);
		}
	});

	return usedKeys;
}

/**
 * Scan .svelte files for translation usage patterns
 */
export function scanTranslationUsage(filePath: string): Set<string> {
	const content = readFileContent(filePath);
	if (!content) {
		return new Set<string>();
	}

	const hasDirectImports = hasTranslationImport(content);
	const keys = extractTranslationKeys(content, hasDirectImports);

	// Debug logging for troubleshooting
	if (keys.size > 0) {
		console.log(
			`🔍 Found ${keys.size} translation keys in ${filePath.replace(process.cwd(), '.')}:`,
			Array.from(keys)
		);
	}

	return keys;
}

/**
 * Check if a path is safe to scan (not in node_modules or other system directories)
 */
function isSafeToScan(filePath: string): boolean {
	// Resolve relative paths to absolute paths for proper checking
	const resolvedPath = resolve(filePath);
	const normalizedPath = resolvedPath.replace(/\\/g, '/');

	// Never scan inside node_modules
	if (normalizedPath.includes('/node_modules/') || normalizedPath.includes('\\node_modules\\')) {
		return false;
	}

	// Never scan inside other system directories
	if (
		normalizedPath.includes('/.git/') ||
		normalizedPath.includes('/.svelte-kit/') ||
		normalizedPath.includes('/dist/') ||
		normalizedPath.includes('/build/') ||
		normalizedPath.includes('/coverage/') ||
		normalizedPath.includes('/.nyc_output/') ||
		normalizedPath.includes('/.vscode/') ||
		normalizedPath.includes('/.idea/') ||
		normalizedPath.includes('/.tmp/') ||
		normalizedPath.includes('/.bak/')
	) {
		return false;
	}

	// Only allow scanning inside the project source directories
	const projectRoot = process.cwd().replace(/\\/g, '/');
	const srcDir = `${projectRoot}/src`;

	// Allow scanning in src/ directory or test directories
	if (!normalizedPath.startsWith(srcDir) && !normalizedPath.includes('/test-')) {
		return false;
	}

	return true;
}

/**
 * Resolve import path
 */
function resolveImportPath(importPath: string, basePath: string): string {
	// First resolve any Vite aliases
	const resolvedAlias = resolveAlias(importPath);

	// Handle relative paths (./ and ../)
	if (resolvedAlias.startsWith('./') || resolvedAlias.startsWith('../')) {
		const resolvedPath = resolve(basePath, resolvedAlias);

		// Safety check: never scan inside node_modules or system directories
		if (!isSafeToScan(resolvedPath)) {
			return ''; // Return empty string to indicate unsafe path
		}

		// Check if the resolved path exists
		if (existsSync(resolvedPath)) {
			return resolvedPath;
		}

		// If not found, try with .svelte extension
		const withExtension = resolvedPath.endsWith('.svelte')
			? resolvedPath
			: `${resolvedPath}.svelte`;
		if (existsSync(withExtension)) {
			return withExtension;
		}

		// If still not found, try resolving from src directory
		const srcPath = resolve(process.cwd(), 'src', resolvedAlias);
		if (existsSync(srcPath)) {
			return srcPath;
		}

		// Try with .svelte extension from src
		const srcWithExtension = srcPath.endsWith('.svelte') ? srcPath : `${srcPath}.svelte`;
		if (existsSync(srcWithExtension)) {
			return srcWithExtension;
		}

		// Try resolving from the base path's src directory
		const baseSrcPath = resolve(dirname(basePath), 'src', resolvedAlias);
		if (existsSync(baseSrcPath)) {
			return baseSrcPath;
		}

		// Try with .svelte extension from base src
		const baseSrcWithExtension = baseSrcPath.endsWith('.svelte')
			? baseSrcPath
			: `${baseSrcPath}.svelte`;
		if (existsSync(baseSrcWithExtension)) {
			return baseSrcWithExtension;
		}

		return resolvedPath; // Return original resolved path if all attempts fail
	}
	// Handle absolute paths from src/
	else if (resolvedAlias.startsWith('src/')) {
		const resolvedPath = resolve(process.cwd(), resolvedAlias);

		// Safety check: never scan inside node_modules or system directories
		if (!isSafeToScan(resolvedPath)) {
			return ''; // Return empty string to indicate unsafe path
		}

		// Check if the resolved path exists
		if (existsSync(resolvedPath)) {
			return resolvedPath;
		}

		// If not found, try with .svelte extension
		const withExtension = resolvedPath.endsWith('.svelte')
			? resolvedPath
			: `${resolvedPath}.svelte`;
		if (existsSync(withExtension)) {
			return withExtension;
		}

		return resolvedPath;
	}
	// Handle absolute paths from root
	else if (resolvedAlias.startsWith('/')) {
		const resolvedPath = resolve(process.cwd(), resolvedAlias);

		// Safety check: never scan inside node_modules or system directories
		if (!isSafeToScan(resolvedPath)) {
			return ''; // Return empty string to indicate unsafe path
		}

		// Check if the resolved path exists
		if (existsSync(resolvedPath)) {
			return resolvedPath;
		}

		// If not found, try with .svelte extension
		const withExtension = resolvedPath.endsWith('.svelte')
			? resolvedPath
			: `${resolvedPath}.svelte`;
		if (existsSync(withExtension)) {
			return withExtension;
		}

		return resolvedPath;
	}

	return resolvedAlias;
}

/**
 * Extract import paths from content
 */
function extractImportPaths(content: string, basePath: string): string[] {
	const imports: string[] = [];

	// Process static imports
	IMPORT_PATTERNS.forEach((pattern) => {
		let match;
		while ((match = pattern.exec(content)) !== null) {
			// Handle different pattern formats
			let importPath: string;
			if (match.length >= 3) {
				// For patterns with multiple capture groups, the last one is usually the path
				importPath = match[match.length - 1];
			} else {
				importPath = match[1];
			}

			const resolvedPath = resolveImportPath(importPath, basePath);

			// Only include if path is safe, file exists and it's a .svelte file
			if (
				resolvedPath &&
				resolvedPath !== '' &&
				existsSync(resolvedPath) &&
				resolvedPath.endsWith('.svelte')
			) {
				imports.push(resolvedPath);
			}
		}
	});

	// Process dynamic imports
	DYNAMIC_IMPORT_PATTERNS.forEach((pattern) => {
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const importPath = match[1]; // First capture group is the path for dynamic imports
			const resolvedPath = resolveImportPath(importPath, basePath);

			// Only include if path is safe, file exists and it's a .svelte file
			if (
				resolvedPath &&
				resolvedPath !== '' &&
				existsSync(resolvedPath) &&
				resolvedPath.endsWith('.svelte')
			) {
				imports.push(resolvedPath);
			}
		}
	});

	return imports;
}

/**
 * Parse import statements from a .svelte file
 */
export function parseImports(filePath: string): string[] {
	// Safety check: never scan inside node_modules or system directories
	if (!isSafeToScan(filePath)) {
		return [];
	}

	const content = readFileContent(filePath);
	if (!content) {
		return [];
	}

	const basePath = dirname(filePath);
	return extractImportPaths(content, basePath);
}

/**
 * Recursively scan a component and all its dependencies
 */
export function scanComponentTree(
	filePath: string,
	visited = new Set<string>(),
	verbose = false,
	maxDepth = 50 // Allow very deep nesting while preventing infinite loops
): Set<string> {
	const allKeys = new Set<string>();

	// Safety check: never scan inside node_modules or system directories
	if (!isSafeToScan(filePath)) {
		if (verbose) {
			console.log(`🚫 Skipping unsafe path: ${filePath.replace(process.cwd(), '.')}`);
		}
		return allKeys;
	}

	// Avoid circular dependencies with better logic
	if (visited.has(filePath)) {
		if (verbose) {
			console.log(
				`🔄 Circular dependency detected, skipping: ${filePath.replace(process.cwd(), '.')}`
			);
		}
		return allKeys;
	}

	// Check depth to prevent infinite loops while allowing deep nesting
	if (visited.size >= maxDepth) {
		if (verbose) {
			console.log(
				`⚠️  Max depth (${maxDepth}) reached, stopping recursion for: ${filePath.replace(process.cwd(), '.')}`
			);
		}
		return allKeys;
	}

	visited.add(filePath);

	if (verbose) {
		console.log(
			`🔍 Scanning component (depth ${visited.size}): ${filePath.replace(process.cwd(), '.')}`
		);
	}

	// Scan this component for translation usage
	const keysFromThisFile = scanTranslationUsage(filePath);
	keysFromThisFile.forEach((key) => allKeys.add(key));

	if (verbose && keysFromThisFile.size > 0) {
		console.log(
			`🔍 Found ${keysFromThisFile.size} keys in ${filePath.replace(process.cwd(), '.')}:`,
			Array.from(keysFromThisFile)
		);
	}

	// Parse and scan all imported components with improved error handling
	const imports = parseImports(filePath);
	if (verbose && imports.length > 0) {
		console.log(
			`📦 Found ${imports.length} imports in ${filePath.replace(process.cwd(), '.')}:`,
			imports.map((p) => p.replace(process.cwd(), '.'))
		);
	}

	for (const importPath of imports) {
		// Verify the import path exists before scanning
		if (!existsSync(importPath)) {
			if (verbose) {
				console.log(
					`⚠️  Import path does not exist, skipping: ${importPath.replace(process.cwd(), '.')}`
				);
			}
			continue;
		}

		if (verbose) {
			console.log(
				`🔗 Following import (depth ${visited.size}): ${importPath.replace(process.cwd(), '.')}`
			);
		}

		try {
			const keysFromImport = scanComponentTree(importPath, visited, verbose, maxDepth);
			keysFromImport.forEach((key) => allKeys.add(key));
		} catch (error) {
			if (verbose) {
				console.log(`❌ Error scanning import ${importPath.replace(process.cwd(), '.')}:`, error);
			}
			// Continue with other imports instead of failing completely
		}
	}

	if (verbose) {
		console.log(
			`✅ Finished scanning ${filePath.replace(process.cwd(), '.')} (depth ${visited.size}), total keys: ${allKeys.size}`
		);
	}

	return allKeys;
}

/**
 * Check if entry is a route file
 */
function isRouteFile(entry: string): boolean {
	return entry === ROUTE_FILES.PAGE || entry === ROUTE_FILES.LAYOUT;
}

/**
 * Get server file path for route file
 */
function getServerFilePath(dirPath: string, isLayout: boolean): string {
	const serverFileName = isLayout ? ROUTE_FILES.LAYOUT_SERVER : ROUTE_FILES.PAGE_SERVER;
	return join(dirPath, serverFileName);
}

/**
 * Create route file object
 */
function createRouteFile(fullPath: string, routesDir: string): RouteFile | null {
	const dirPath = dirname(fullPath);
	const entry = fullPath.split('/').pop()!;
	const isLayout = entry === ROUTE_FILES.LAYOUT;

	return {
		filePath: fullPath,
		serverFile: getServerFilePath(dirPath, isLayout),
		routePath: getRoutePath(fullPath, routesDir),
		isLayout
	};
}

/**
 * Process route file and add to pages if it has translations
 */
function processRouteFile(
	routeFile: RouteFile,
	pages: PageTranslationUsage[],
	verbose: boolean
): void {
	const { filePath, serverFile, routePath } = routeFile;

	if (verbose) {
		console.log(`🔍 Processing route file: ${filePath.replace(process.cwd(), '.')} (${routePath})`);
	}

	// Use deep scanning to find all translation keys from this component and its dependencies
	const usedKeys = scanComponentTree(filePath, new Set(), verbose);

	// Always add the page to ensure server files are created
	// This allows for dynamic updates when translation keys are added later
	pages.push({
		pageFile: filePath,
		serverFile,
		usedKeys,
		routePath
	});

	if (verbose && usedKeys.size > 0) {
		console.log(
			`🔍 Found ${usedKeys.size} translation keys in ${filePath.replace(process.cwd(), '.')} (including dependencies):`,
			Array.from(usedKeys)
		);
	} else if (verbose) {
		console.log(
			`📄 No translation keys found in ${filePath.replace(process.cwd(), '.')} or its dependencies - server file will be created for future use`
		);
	}
}

/**
 * Scan directory recursively for route files
 */
function scanDirectoryForRoutes(
	dir: string,
	pages: PageTranslationUsage[],
	routesDir: string,
	verbose: boolean
): void {
	try {
		const entries = readdirSync(dir);

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);

			if (stat.isDirectory()) {
				// Recursively scan subdirectories
				scanDirectoryForRoutes(fullPath, pages, routesDir, verbose);
			} else if (isRouteFile(entry)) {
				// Found a route file, process it
				const routeFile = createRouteFile(fullPath, routesDir);
				if (routeFile) {
					processRouteFile(routeFile, pages, verbose);
				}
			}
		}
	} catch (error) {
		console.error(`❌ Error scanning directory ${dir}:`, error);
	}
}

/**
 * Find all .svelte pages and their corresponding server files with route hierarchy
 */
export function findPageTranslationUsage(
	routesDir: string,
	verbose = false
): PageTranslationUsage[] {
	const pages: PageTranslationUsage[] = [];

	if (existsSync(routesDir)) {
		scanDirectoryForRoutes(routesDir, pages, routesDir, verbose);
	}

	return pages;
}

/**
 * Calculate route depth for sorting
 */
function getRouteDepth(routePath: string): number {
	return routePath.split('/').length;
}

/**
 * Sort pages by route depth (shallowest first for layouts)
 */
function sortPagesByDepth(pages: PageTranslationUsage[]): PageTranslationUsage[] {
	return pages.sort((a, b) => {
		const aDepth = getRouteDepth(a.routePath);
		const bDepth = getRouteDepth(b.routePath);
		return aDepth - bDepth;
	});
}

/**
 * Initialize route keys map
 */
function initializeRouteKeys(routePath: string, routeKeys: Map<string, Set<string>>): Set<string> {
	if (!routeKeys.has(routePath)) {
		routeKeys.set(routePath, new Set());
	}
	return routeKeys.get(routePath)!;
}

/**
 * Add keys to child routes for layouts
 */
function addKeysToChildRoutes(
	routePath: string,
	usedKeys: Set<string>,
	routeKeys: Map<string, Set<string>>
): void {
	for (const [childRoute, childKeys] of Array.from(routeKeys.entries())) {
		if (childRoute !== routePath && childRoute.startsWith(routePath)) {
			usedKeys.forEach((key) => childKeys.add(key));
		}
	}
}

/**
 * Build route hierarchy and collect all keys for each route
 */
export function buildRouteHierarchy(pages: PageTranslationUsage[]): Map<string, Set<string>> {
	const routeKeys = new Map<string, Set<string>>();
	const sortedPages = sortPagesByDepth(pages);

	for (const page of sortedPages) {
		const { routePath, usedKeys, pageFile } = page;
		const isLayout = pageFile.includes(ROUTE_FILES.LAYOUT);

		// Initialize route keys
		const currentKeys = initializeRouteKeys(routePath, routeKeys);

		// Add keys from this route
		usedKeys.forEach((key) => currentKeys.add(key));

		// For layouts, also add keys to all child routes
		if (isLayout) {
			addKeysToChildRoutes(routePath, usedKeys, routeKeys);
		}
	}

	return routeKeys;
}
