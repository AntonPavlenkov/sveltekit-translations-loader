import { existsSync, readdirSync, statSync } from 'fs';
import { basename, dirname, join, relative, resolve } from 'path';
import { injectTranslationKeys } from './load-function-updater.js';
import { scanComponentTree, setSvelteKitConfig } from './scanner.js';
import { readFileContentSilent } from './shared-utils.js';

// Types
export interface ComponentUsage {
	componentPath: string;
	usedBy: Set<string>; // Set of file paths that use this component
}

export interface DependencyMap {
	[componentPath: string]: ComponentUsage;
}

export interface SvelteKitConfig {
	kit?: {
		alias?: Record<string, string>;
	};
}

// Constants
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
 * Resolve import path relative to base path
 */
function resolveImportPath(importPath: string, basePath: string): string {
	if (importPath.startsWith('./') || importPath.startsWith('../')) {
		const resolvedPath = resolve(dirname(basePath), importPath);

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
		const srcPath = resolve(process.cwd(), 'src', importPath);
		if (existsSync(srcPath)) {
			return srcPath;
		}

		// Try with .svelte extension from src
		const srcWithExtension = srcPath.endsWith('.svelte') ? srcPath : `${srcPath}.svelte`;
		if (existsSync(srcWithExtension)) {
			return srcWithExtension;
		}

		// Try resolving from the base path's src directory
		const baseSrcPath = resolve(dirname(basePath), 'src', importPath);
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
	if (importPath.startsWith('/')) {
		const resolvedPath = resolve(process.cwd(), importPath);

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
	return importPath;
}

/**
 * Extract all component imports from a file
 */
function extractComponentImports(content: string, basePath: string): string[] {
	const imports = new Set<string>();

	// Extract static imports
	for (const pattern of IMPORT_PATTERNS) {
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const importPath = match[2] || match[1];
			const resolvedPath = resolveImportPath(importPath, basePath);
			if (resolvedPath && resolvedPath !== '' && resolvedPath.endsWith('.svelte')) {
				imports.add(resolvedPath);
			}
		}
	}

	// Extract dynamic imports
	for (const pattern of DYNAMIC_IMPORT_PATTERNS) {
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const importPath = match[1];
			const resolvedPath = resolveImportPath(importPath, basePath);
			if (resolvedPath && resolvedPath !== '' && resolvedPath.endsWith('.svelte')) {
				imports.add(resolvedPath);
			}
		}
	}

	return Array.from(imports);
}

/**
 * Check if file uses translations (i18n imports or _loadedTranslations)
 */
function hasTranslationUsage(content: string): boolean {
	// Check for @i18n imports
	const i18nImportPatterns = [
		/import\s+\*\s+as\s+\w+\s+from\s+['"]@i18n['"]/g,
		/import\s+\{\s*[^}]*\s*\}\s+from\s+['"]@i18n['"]/g,
		/import\s+\w+\s+from\s+['"]@i18n['"]/g
	];

	const hasI18nImports = i18nImportPatterns.some((pattern) => pattern.test(content));

	// Check for _loadedTranslations usage
	const hasLoadedTranslations = content.includes('_loadedTranslations');

	return hasI18nImports || hasLoadedTranslations;
}

/**
 * Build dependency map by scanning all .svelte files
 */
export function buildDependencyMap(routesDir: string, verbose = false): DependencyMap {
	const dependencyMap: DependencyMap = {};
	const routesPath = resolve(routesDir);

	if (!existsSync(routesPath)) {
		return dependencyMap;
	}

	// Recursively scan all .svelte files
	function scanDirectory(dir: string) {
		try {
			const entries = readdirSync(dir);
			for (const entry of entries) {
				const fullPath = join(dir, entry);
				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					scanDirectory(fullPath);
				} else if (entry.endsWith('.svelte')) {
					const content = readFileContentSilent(fullPath);
					if (content) {
						// Use deep scanning to get all component imports including nested ones
						const imports = extractComponentImports(content, fullPath);

						// Initialize component usage if not exists
						if (!dependencyMap[fullPath]) {
							dependencyMap[fullPath] = {
								componentPath: fullPath,
								usedBy: new Set()
							};
						}

						// Add this file as a user of each imported component
						for (const importPath of imports) {
							if (!dependencyMap[importPath]) {
								dependencyMap[importPath] = {
									componentPath: importPath,
									usedBy: new Set()
								};
							}
							dependencyMap[importPath].usedBy.add(fullPath);
						}

						if (verbose && imports.length > 0) {
							console.log(
								`🔗 ${relative(routesPath, fullPath)} imports:`,
								imports.map((p) => relative(routesPath, p))
							);
						}
					}
				}
			}
		} catch (error) {
			if (verbose) {
				console.log(`⚠️  Error scanning directory ${dir}:`, error);
			}
		}
	}

	// First scan the routes directory
	scanDirectory(routesPath);

	// Then scan for components outside routes that are used by page components
	const projectRoot = resolve(process.cwd());
	const srcDir = join(projectRoot, 'src');

	if (existsSync(srcDir)) {
		// Find all .svelte files in src that are not in routes
		const scanSrcForComponents = (dir: string) => {
			try {
				const entries = readdirSync(dir);
				for (const entry of entries) {
					const fullPath = join(dir, entry);
					const stat = statSync(fullPath);

					if (stat.isDirectory()) {
						// Skip routes directory as it's already scanned
						if (fullPath === routesPath) continue;
						scanSrcForComponents(fullPath);
					} else if (entry.endsWith('.svelte')) {
						const content = readFileContentSilent(fullPath);
						if (content) {
							// Use deep scanning to get all component imports including nested ones
							const imports = extractComponentImports(content, fullPath);

							// Initialize component usage if not exists
							if (!dependencyMap[fullPath]) {
								dependencyMap[fullPath] = {
									componentPath: fullPath,
									usedBy: new Set()
								};
							}

							// Add this file as a user of each imported component
							for (const importPath of imports) {
								if (!dependencyMap[importPath]) {
									dependencyMap[importPath] = {
										componentPath: importPath,
										usedBy: new Set()
									};
								}
								dependencyMap[importPath].usedBy.add(fullPath);
							}

							if (verbose && imports.length > 0) {
								console.log(
									`🔗 ${relative(projectRoot, fullPath)} imports:`,
									imports.map((p) => relative(projectRoot, p))
								);
							}
						}
					}
				}
			} catch (error) {
				if (verbose) {
					console.log(`⚠️  Error scanning src directory ${dir}:`, error);
				}
			}
		};

		scanSrcForComponents(srcDir);
	}

	return dependencyMap;
}

/**
 * Find all files that use a specific component (directly or indirectly)
 */
export function findComponentUsers(
	componentPath: string,
	dependencyMap: DependencyMap
): Set<string> {
	const users = new Set<string>();
	const visited = new Set<string>();

	const findUsersRecursive = (path: string) => {
		if (visited.has(path)) return;
		visited.add(path);

		const component = dependencyMap[path];
		if (component) {
			for (const user of Array.from(component.usedBy)) {
				users.add(user);
				findUsersRecursive(user);
			}
		}
	};

	findUsersRecursive(componentPath);
	return users;
}

/**
 * Find the page component that uses a given component (traces up the dependency chain)
 */
export function findPageComponent(
	componentPath: string,
	dependencyMap: DependencyMap,
	routesDir: string,
	verbose = false
): string | null {
	const visited = new Set<string>();

	const findPageRecursive = (path: string): string | null => {
		if (visited.has(path)) return null;
		visited.add(path);

		// Check if this is a page component
		if (path.includes('+page.svelte') || path.includes('+layout.svelte')) {
			return path;
		}

		// Check if this component uses translations
		const content = readFileContentSilent(path);
		if (content && hasTranslationUsage(content)) {
			if (verbose) {
				console.log(`🔍 Component ${path} uses translations`);
			}
		}

		// Find users of this component
		const component = dependencyMap[path];
		if (component) {
			for (const user of Array.from(component.usedBy)) {
				const pageComponent = findPageRecursive(user);
				if (pageComponent) {
					return pageComponent;
				}
			}
		}

		return null;
	};

	return findPageRecursive(componentPath);
}

/**
 * Get route path from file path
 */
function getRoutePath(filePath: string, routesDir: string): string {
	const relativePath = relative(routesDir, filePath);
	const routePath = relativePath
		.replace(/\.svelte$/, '')
		.replace(/\+page$/, '')
		.replace(/\+layout$/, '')
		.replace(/\/$/, '')
		.replace(/^\//, '');

	return routePath || '/';
}

/**
 * Find all page.server.ts files that need to be updated when a component changes
 */
export function findAffectedServerFiles(
	componentPath: string,
	dependencyMap: DependencyMap,
	routesDir: string,
	verbose = false
): string[] {
	const routesPath = resolve(routesDir);
	const users = findComponentUsers(componentPath, dependencyMap);
	const serverFiles = new Set<string>();

	for (const userPath of Array.from(users)) {
		// Check if this is a page or layout file
		const fileName = userPath.split('/').pop();
		if (fileName === '+page.svelte' || fileName === '+layout.svelte') {
			const dirPath = dirname(userPath);
			const serverFile = join(
				dirPath,
				fileName === '+page.svelte' ? '+page.server.ts' : '+layout.server.ts'
			);

			// Always include the server file path, whether it exists or not
			// The injectTranslationKeys function will create it if it doesn't exist
			serverFiles.add(serverFile);
			if (verbose) {
				const routePath = getRoutePath(userPath, routesPath);
				const exists = existsSync(serverFile);
				console.log(
					`🎯 Component ${relative(routesPath, componentPath)} affects route: ${routePath} (server file ${exists ? 'exists' : 'will be created'})`
				);
			}
		}
	}

	return Array.from(serverFiles);
}

/**
 * Update server files when a component changes
 */
export async function updateAffectedServerFiles(
	componentPath: string,
	dependencyMap: DependencyMap,
	routesDir: string,
	verbose = false
): Promise<void> {
	const serverFiles = findAffectedServerFiles(componentPath, dependencyMap, routesDir, verbose);
	const routesPath = resolve(routesDir);

	for (const serverFile of serverFiles) {
		// Find the corresponding page/layout file
		const pageFile = serverFile.replace('.server.ts', '.svelte');

		// Always process the page file, injectTranslationKeys will handle file creation
		// Scan the page file for translation keys
		const usedKeys = scanComponentTree(pageFile, new Set(), verbose);
		const routePath = getRoutePath(pageFile, routesPath);

		if (verbose) {
			console.log(`🔄 Updating ${relative(routesPath, serverFile)} for route ${routePath}`);
			console.log(`🔑 Found keys:`, Array.from(usedKeys));
		}

		// Update the server file (will create if it doesn't exist)
		injectTranslationKeys(serverFile, usedKeys, routePath, verbose);
	}
}

/**
 * Handle component change by updating all affected server files
 */
export async function handleComponentChange(
	changedFilePath: string,
	routesDir: string,
	verbose = false
): Promise<void> {
	const routesPath = resolve(routesDir);

	// Process any .svelte files (not just those in routes directory)
	if (!changedFilePath.endsWith('.svelte')) {
		return;
	}

	if (verbose) {
		const relativePath = changedFilePath.includes(routesPath)
			? relative(routesPath, changedFilePath)
			: relative(process.cwd(), changedFilePath);
		console.log(`🔄 Component changed: ${relativePath}`);
	}

	// Build dependency map
	const dependencyMap = buildDependencyMap(routesDir, verbose);

	// Check if this component or any of its users have translation usage
	const componentContent = readFileContentSilent(changedFilePath);
	const hasDirectUsage = componentContent && hasTranslationUsage(componentContent);

	if (hasDirectUsage && verbose) {
		console.log(`🔍 Component ${basename(changedFilePath)} has direct translation usage`);
	}

	// Find all users of this component
	const users = findComponentUsers(changedFilePath, dependencyMap);
	let hasIndirectUsage = false;

	for (const user of Array.from(users)) {
		const userContent = readFileContentSilent(user);
		if (userContent && hasTranslationUsage(userContent)) {
			hasIndirectUsage = true;
			if (verbose) {
				console.log(
					`🔍 Component ${basename(changedFilePath)} is used by ${basename(user)} which has translation usage`
				);
			}
			break;
		}
	}

	// Only update if there's translation usage (direct or indirect)
	if (hasDirectUsage || hasIndirectUsage) {
		// Update affected server files
		await updateAffectedServerFiles(changedFilePath, dependencyMap, routesDir, verbose);
	} else if (verbose) {
		console.log(`⏭️  Skipping ${basename(changedFilePath)} - no translation usage detected`);
	}
}

/**
 * Set SvelteKit config for alias resolution in dependency tracking
 */
export function setDependencyTrackerConfig(config: SvelteKitConfig): void {
	setSvelteKitConfig(config);
}
