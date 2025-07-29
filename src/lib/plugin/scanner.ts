import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { getRoutePath } from './helpers.js';

export interface PageTranslationUsage {
	pageFile: string;
	serverFile: string;
	usedKeys: Set<string>;
	routePath: string; // Add route path for nested route handling
}

/**
 * Scan .svelte files for translation usage patterns
 */
export function scanTranslationUsage(filePath: string): Set<string> {
	const usedKeys = new Set<string>();

	try {
		const content = readFileSync(filePath, 'utf8');

		// First, check if this file imports from the translations library
		const hasTranslationImport = /import\s+\{[^}]*\}\s+from\s+['"]\$lib\/index\.js['"]/.test(
			content
		);

		// Match patterns like t.hello(), t.welcome(), t.userCount(), t['user-count']()
		// Also match data._loadedTranslations.hello, data._loadedTranslations['user-count']
		// And match direct function calls like hello(), welcome() when imported from $lib/index.js
		const patterns = [
			/\bt\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/g, // t.hello()
			/\bt\[['"]([^'"]+)['"]\]\s*\(/g, // t['user-count']()
			/\bdata\._loadedTranslations\.([a-zA-Z][a-zA-Z0-9]*)\b/g, // data._loadedTranslations.hello
			/\bdata\._loadedTranslations\[['"]([^'"]+)['"]\]/g // data._loadedTranslations['user-count']
		];

		// If file imports from $lib/index.js, also look for direct function calls
		if (hasTranslationImport) {
			patterns.push(/\b([a-zA-Z][a-zA-Z0-9]*)\s*\(/g); // hello(), welcome(), etc.
		}

		patterns.forEach((pattern) => {
			let match;
			while ((match = pattern.exec(content)) !== null) {
				const key = match[1];

				// Convert camelCase back to kebab-case to find original key
				const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();

				// Add both the original camelCase and potential kebab-case variants
				usedKeys.add(key);
				if (kebabKey !== key) {
					usedKeys.add(kebabKey);
				}
			}
		});
	} catch (error) {
		console.error(`❌ Error scanning ${filePath}:`, error);
	}

	return usedKeys;
}

/**
 * Parse import statements from a .svelte file
 */
export function parseImports(filePath: string): string[] {
	const imports: string[] = [];

	try {
		const content = readFileSync(filePath, 'utf8');
		const basePath = dirname(filePath);

		// Match import statements for .svelte files
		const importPatterns = [
			/import\s+(\w+)\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import Component from './Component.svelte'
			/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import { Component } from './Component.svelte'
			/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+\.svelte)['"]/g // import * as Components from './Component.svelte'
		];

		importPatterns.forEach((pattern) => {
			let match;
			while ((match = pattern.exec(content)) !== null) {
				let importPath = match[match.length - 1]; // Last capture group is always the path

				// Resolve relative imports
				if (importPath.startsWith('./') || importPath.startsWith('../')) {
					importPath = resolve(basePath, importPath);
				} else if (importPath.startsWith('$lib/')) {
					// Handle $lib alias
					importPath = resolve('src/lib', importPath.substring(5));
				}

				// Only include if file exists
				if (existsSync(importPath)) {
					imports.push(importPath);
				}
			}
		});
	} catch (error) {
		console.error(`❌ Error parsing imports from ${filePath}:`, error);
	}

	return imports;
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
 * Find all .svelte pages and their corresponding server files with route hierarchy
 */
export function findPageTranslationUsage(routesDir: string): PageTranslationUsage[] {
	const pages: PageTranslationUsage[] = [];

	function scanDirectory(dir: string) {
		try {
			const entries = readdirSync(dir);

			for (const entry of entries) {
				const fullPath = join(dir, entry);
				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					// Recursively scan subdirectories
					scanDirectory(fullPath);
				} else if (entry === '+page.svelte') {
					// Found a page, check for corresponding server file
					const pageFile = fullPath;
					const serverFile = join(dirname(fullPath), '+page.server.ts');
					const usedKeys = scanComponentTree(pageFile);
					const routePath = getRoutePath(pageFile, routesDir);

					if (usedKeys.size > 0) {
						pages.push({
							pageFile,
							serverFile,
							usedKeys,
							routePath
						});
					}
				} else if (entry === '+layout.svelte') {
					// Found a layout, check for corresponding server file
					const layoutFile = fullPath;
					const serverFile = join(dirname(fullPath), '+layout.server.ts');
					const usedKeys = scanComponentTree(layoutFile);
					const routePath = getRoutePath(layoutFile, routesDir);

					if (usedKeys.size > 0) {
						pages.push({
							pageFile: layoutFile, // Reuse the same interface
							serverFile,
							usedKeys,
							routePath
						});
					}
				}
			}
		} catch (error) {
			console.error(`❌ Error scanning directory ${dir}:`, error);
		}
	}

	if (existsSync(routesDir)) {
		scanDirectory(routesDir);
	}

	return pages;
}

/**
 * Build route hierarchy and collect all keys for each route
 */
export function buildRouteHierarchy(pages: PageTranslationUsage[]): Map<string, Set<string>> {
	const routeKeys = new Map<string, Set<string>>();

	// Sort pages by route depth (shallowest first for layouts)
	const sortedPages = pages.sort((a, b) => {
		const aDepth = a.routePath.split('/').length;
		const bDepth = b.routePath.split('/').length;
		return aDepth - bDepth;
	});

	for (const page of sortedPages) {
		const { routePath, usedKeys, pageFile } = page;
		const isLayout = pageFile.includes('+layout.svelte');

		// Initialize route keys if not exists
		if (!routeKeys.has(routePath)) {
			routeKeys.set(routePath, new Set());
		}

		const currentKeys = routeKeys.get(routePath)!;

		// Add keys from this route
		usedKeys.forEach((key) => currentKeys.add(key));

		// For layouts, also add keys to all child routes
		if (isLayout) {
			for (const [childRoute, childKeys] of routeKeys.entries()) {
				if (childRoute !== routePath && childRoute.startsWith(routePath)) {
					usedKeys.forEach((key) => childKeys.add(key));
				}
			}
		}
	}

	return routeKeys;
}
