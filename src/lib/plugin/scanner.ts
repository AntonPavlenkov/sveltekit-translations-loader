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
	/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+\.svelte)['"]/g // import * as Components from './Component.svelte'
] as const;

const DYNAMIC_IMPORT_PATTERNS = [
	/import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // import('Component.svelte')
	/await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // await import('Component.svelte')
	/const\s+\w+\s*=\s*await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // const c = await import('Component.svelte')
	/let\s+\w+\s*=\s*await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // let c = await import('Component.svelte')
	/var\s+\w+\s*=\s*await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // var c = await import('Component.svelte')
	/=\s*import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g // = import('Component.svelte')
] as const;

const ROUTE_FILES = {
	PAGE: '+page.svelte',
	LAYOUT: '+layout.svelte',
	PAGE_SERVER: '+page.server.ts',
	LAYOUT_SERVER: '+layout.server.ts'
} as const;

// Global variable to store Vite config for alias resolution
let globalViteConfig: ViteConfig = {};

/**
 * Set Vite config for alias resolution
 */
export function setViteConfig(config: ViteConfig): void {
	globalViteConfig = config;
}

/**
 * Resolve import alias using Vite config
 */
function resolveAlias(importPath: string): string {
	// Check if it's an alias that needs resolution
	if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('/')) {
		return importPath; // Not an alias
	}

	// Get aliases from Vite config
	const aliases = globalViteConfig.alias || globalViteConfig.resolve?.alias;
	if (!aliases) {
		return importPath;
	}

	// Handle array format: [{ find: '@variants', replacement: 'src/variants' }]
	if (Array.isArray(aliases)) {
		for (const alias of aliases) {
			if (typeof alias.find === 'string' && importPath.startsWith(alias.find)) {
				return importPath.replace(alias.find, alias.replacement);
			} else if (alias.find instanceof RegExp && alias.find.test(importPath)) {
				return importPath.replace(alias.find, alias.replacement);
			}
		}
	}
	// Handle object format: { '@variants': 'src/variants' }
	else if (typeof aliases === 'object') {
		for (const [alias, replacement] of Object.entries(aliases)) {
			if (importPath.startsWith(alias)) {
				return importPath.replace(alias, replacement);
			}
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
 * Resolve import path
 */
function resolveImportPath(importPath: string, basePath: string): string {
	// First resolve any Vite aliases
	const resolvedAlias = resolveAlias(importPath);

	if (resolvedAlias.startsWith('./') || resolvedAlias.startsWith('../')) {
		return resolve(basePath, resolvedAlias);
	} else if (resolvedAlias.startsWith('$lib/')) {
		// Handle $lib alias
		return resolve(process.cwd(), resolvedAlias);
	} else if (resolvedAlias.startsWith('src/')) {
		// Handle resolved aliases that point to src/
		return resolve(process.cwd(), resolvedAlias);
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
			const importPath = match[match.length - 1]; // Last capture group is always the path
			const resolvedPath = resolveImportPath(importPath, basePath);

			// Only include if file exists
			if (existsSync(resolvedPath)) {
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

			// Only include if file exists
			if (existsSync(resolvedPath)) {
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
	verbose = false
): Set<string> {
	const allKeys = new Set<string>();

	// Avoid circular dependencies
	if (visited.has(filePath)) {
		return allKeys;
	}
	visited.add(filePath);

	// Scan this component for translation usage
	const keysFromThisFile = scanTranslationUsage(filePath);
	keysFromThisFile.forEach((key) => allKeys.add(key));

	if (verbose && keysFromThisFile.size > 0) {
		console.log(
			`🔍 Found ${keysFromThisFile.size} keys in ${filePath.replace(process.cwd(), '.')}:`,
			Array.from(keysFromThisFile)
		);
	}

	// Parse and scan all imported components
	const imports = parseImports(filePath);
	if (verbose && imports.length > 0) {
		console.log(
			`📦 Scanning ${imports.length} imports in ${filePath.replace(process.cwd(), '.')}:`,
			imports.map((p) => p.replace(process.cwd(), '.'))
		);
	}

	for (const importPath of imports) {
		const keysFromImport = scanComponentTree(importPath, visited, verbose);
		keysFromImport.forEach((key) => allKeys.add(key));
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
			`🔍 Found ${usedKeys.size} translation keys in ${filePath.replace(process.cwd(), '.')}:`,
			Array.from(usedKeys)
		);
	} else if (verbose) {
		console.log(
			`📄 No translation keys found in ${filePath.replace(process.cwd(), '.')} - server file will be created for future use`
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
	for (const [childRoute, childKeys] of routeKeys.entries()) {
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
