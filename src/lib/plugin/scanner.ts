import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { getRoutePath } from './helpers.js';

// Constants
const TRANSLATION_IMPORT_PATTERN =
	/import\s+\{[^}]*\}\s+from\s+['"]sveltekit-translations-loader['"]/;

const TRANSLATION_USAGE_PATTERNS = [
	/\bt\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/g, // t.hello()
	/\bt\[['"]([^'"]+)['"]\]\s*\(/g, // t['user-count']()
	/\bdata\._loadedTranslations\.([a-zA-Z][a-zA-Z0-9]*)\b/g, // data._loadedTranslations.hello
	/\bdata\._loadedTranslations\[['"]([^'"]+)['"]\]/g // data._loadedTranslations['user-count']
] as const;

const DIRECT_FUNCTION_PATTERN = /\b([a-zA-Z][a-zA-Z0-9]*)\s*\(/g; // hello(), welcome(), etc.

const IMPORT_PATTERNS = [
	/import\s+(\w+)\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import Component from './Component.svelte'
	/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import { Component } from './Component.svelte'
	/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+\.svelte)['"]/g // import * as Components from './Component.svelte'
] as const;

const ROUTE_FILES = {
	PAGE: '+page.svelte',
	LAYOUT: '+layout.svelte',
	PAGE_SERVER: '+page.server.ts',
	LAYOUT_SERVER: '+layout.server.ts'
} as const;

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
	return TRANSLATION_IMPORT_PATTERN.test(content);
}

/**
 * Extract translation keys from content using patterns
 */
function extractTranslationKeys(content: string, hasDirectImports: boolean): Set<string> {
	const usedKeys = new Set<string>();

	// Use all standard patterns
	const patterns = [...TRANSLATION_USAGE_PATTERNS];

	// Add direct function pattern if file imports translations
	if (hasDirectImports) {
		patterns.push(DIRECT_FUNCTION_PATTERN);
	}

	// Extract keys from all patterns
	patterns.forEach((pattern) => {
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const key = match[1];
			addKeyVariants(usedKeys, key);
		}
	});

	return usedKeys;
}

/**
 * Read file content safely
 */
function readFileContent(filePath: string): string | null {
	try {
		return readFileSync(filePath, 'utf8');
	} catch (error) {
		console.error(`❌ Error reading ${filePath}:`, error);
		return null;
	}
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
	return extractTranslationKeys(content, hasDirectImports);
}

/**
 * Resolve import path
 */
function resolveImportPath(importPath: string, basePath: string): string {
	if (importPath.startsWith('./') || importPath.startsWith('../')) {
		return resolve(basePath, importPath);
	} else if (importPath.startsWith('$lib/')) {
		// Handle $lib alias
		return resolve('src/lib', importPath.substring(5));
	}

	return importPath;
}

/**
 * Extract import paths from content
 */
function extractImportPaths(content: string, basePath: string): string[] {
	const imports: string[] = [];

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
export function scanComponentTree(filePath: string, visited = new Set<string>()): Set<string> {
	const allKeys = new Set<string>();

	// Avoid circular dependencies
	if (visited.has(filePath)) {
		return allKeys;
	}
	visited.add(filePath);

	// Scan this component for translation usage
	const keysFromThisFile = scanTranslationUsage(filePath);
	keysFromThisFile.forEach((key) => allKeys.add(key));

	// Parse and scan all imported components
	const imports = parseImports(filePath);
	for (const importPath of imports) {
		const keysFromImport = scanComponentTree(importPath, visited);
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
function processRouteFile(routeFile: RouteFile, pages: PageTranslationUsage[]): void {
	const { filePath, serverFile, routePath } = routeFile;
	const usedKeys = scanComponentTree(filePath);

	if (usedKeys.size > 0) {
		pages.push({
			pageFile: filePath,
			serverFile,
			usedKeys,
			routePath
		});
	}
}

/**
 * Scan directory recursively for route files
 */
function scanDirectoryForRoutes(
	dir: string,
	pages: PageTranslationUsage[],
	routesDir: string
): void {
	try {
		const entries = readdirSync(dir);

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);

			if (stat.isDirectory()) {
				// Recursively scan subdirectories
				scanDirectoryForRoutes(fullPath, pages, routesDir);
			} else if (isRouteFile(entry)) {
				// Found a route file, process it
				const routeFile = createRouteFile(fullPath, routesDir);
				if (routeFile) {
					processRouteFile(routeFile, pages);
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
export function findPageTranslationUsage(routesDir: string): PageTranslationUsage[] {
	const pages: PageTranslationUsage[] = [];

	if (existsSync(routesDir)) {
		scanDirectoryForRoutes(routesDir, pages, routesDir);
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
