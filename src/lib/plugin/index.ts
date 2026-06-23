import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { pathToFileURL } from 'url';
import type { Plugin, ViteDevServer } from 'vite';
import {
	getProjectRoot,
	isInsideProjectRoot,
	resolveFromRoot,
	setProjectRoot
} from './project-root.js';

// Import from separated modules
import { forceFlushFileWrites, getGlobalBatchWriter } from './batch-file-writer.js';
import { handleComponentChange } from './dependency-tracker.js';
import { generateTranslations } from './function-generator.js';
import { resolveTranslationKeys, transformTranslationCode } from './helpers.js';
import { injectTranslationKeys } from './load-function-updater.js';
import {
	buildRouteHierarchy,
	findPageTranslationUsage,
	setSvelteKitConfig,
	setViteConfig
} from './scanner.js';

import { generateTypeDeclarations } from './type-generator.js';
// Constants
const VIRTUAL_MODULE_ID = '@i18n';
const VIRTUAL_MODULE_INTERNAL_ID = '\0@i18n';

const I18N_IMPORT_PATTERNS = ["import * as t from '@i18n'", 'import * as t from "@i18n"'] as const;

const ROUTES_DIR = 'src/routes';
const HELPERS_UTILS_PATH = 'src/lib/helpers/utils.ts';

/**
 * Shared component directories (relative to the project root) that the plugin
 * scans/watches in addition to `src/routes`. Kept intentionally small and always
 * confined to the project root so a monorepo's sibling packages are never touched.
 */
const DEFAULT_INCLUDE_DIRS = [
	'lib',
	'components',
	'variants',
	'shared',
	'ui',
	'common'
] as const;

// Debouncing constants
const DEBOUNCE_DELAY = 100; // 100ms debounce delay for better responsiveness

// Types
export interface PluginConfig {
	defaultPath: string;
	verbose?: boolean;
	/**
	 * Automatically add generated messages directory to .gitignore
	 * @default true
	 */
	autoGitignore?: boolean;
	/**
	 * Enable Console Ninja protection to prevent interference with file writes.
	 * When enabled, the plugin will detect Console Ninja injected code and skip writes to prevent corruption.
	 * @default true
	 */
	consoleNinjaProtection?: boolean;
	/**
	 * Explicit project root the plugin is allowed to scan, watch, and write to.
	 *
	 * Defaults to Vite's resolved `config.root`. Set this in monorepos where the
	 * dev/build process is launched from a different working directory than the
	 * SvelteKit app, to guarantee the plugin never crawls into sibling packages.
	 */
	root?: string;
	/**
	 * Shared component directories (relative to the project root) to scan and
	 * watch for translation usage, in addition to `src/routes`. Each entry is
	 * resolved against `<root>/src`. Anything resolving outside the project root
	 * is ignored.
	 *
	 * @default ['lib', 'components', 'variants', 'shared', 'ui', 'common']
	 */
	includeDirs?: string[];
}

interface PluginState {
	isBuildMode: boolean;
	isDevelopment: boolean;
	defaultTranslations: Record<string, string>;
	processingTimeout: NodeJS.Timeout | null;
	lastProcessedFiles: Set<string>;
	translationsHash: string;
	viteConfig: BuildConfig; // Store Vite config for alias resolution
}

interface BuildConfig {
	command: string;
	mode: string;
	root?: string;
	alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
	resolve?: {
		alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
	};
}

/**
 * Check if we're in development mode for the library itself
 */
function detectDevelopmentMode(): boolean {
	return (
		process.cwd().includes('sveltekit-translations-loader') &&
		existsSync(resolve(HELPERS_UTILS_PATH))
	);
}

import { injectRouteKeysMap } from './route-keys-map-generator.js';
import { createHash } from './shared-utils.js';
import { injectTranslationsInjector } from './translations-injector-generator.js';

/**
 * Load default translations from the specified path
 */
async function loadDefaultTranslations(defaultPath: string): Promise<Record<string, string>> {
	const translationsPath = resolveFromRoot(defaultPath);
	try {
		// Build a valid file:// URL (handles spaces/special chars and avoids
		// Vite/Rolldown "invalid file URL" warnings) and bust the module cache.
		const translationsUrl = pathToFileURL(translationsPath);
		translationsUrl.searchParams.set('t', String(Date.now()));
		translationsUrl.searchParams.set('rand', String(Math.random()));
		const translationsModule = await import(/* @vite-ignore */ translationsUrl.href);

		return translationsModule.default || translationsModule;
	} catch (error) {
		console.error(`Failed to load translations from ${translationsPath}:`, error);
		return {};
	}
}

/**
 * Check if file should trigger reprocessing
 */
function shouldReprocessFile(file: string, defaultPath: string): boolean {
	// Normalize path separators for cross-platform compatibility
	const normalizedFile = file.replace(/\\/g, '/');

	// Hard boundary: ignore anything outside the project root so changes in
	// sibling packages of a monorepo never trigger reprocessing here.
	if (!isInsideProjectRoot(file)) {
		return false;
	}

	// Skip generated, temporary, system files, and node_modules to prevent loops
	if (
		normalizedFile.includes('.svelte-kit/') ||
		normalizedFile.includes('node_modules/') ||
		normalizedFile.includes('.tmp') ||
		normalizedFile.includes('.bak') ||
		normalizedFile.includes('~') ||
		normalizedFile.includes('$types.ts') ||
		normalizedFile.includes('.d.ts') ||
		normalizedFile.includes('/.git/') ||
		normalizedFile.includes('/.vscode/') ||
		normalizedFile.includes('/.idea/') ||
		normalizedFile.includes('/dist/') ||
		normalizedFile.includes('/build/') ||
		normalizedFile.includes('/coverage/') ||
		normalizedFile.includes('/.nyc_output/')
	) {
		return false;
	}

	// Process translation files
	if (normalizedFile.includes(defaultPath)) {
		return true;
	}

	// For .svelte files in routes directory or any .svelte files that might be used by pages
	// This will be done in the file watcher callback for better performance
	if (normalizedFile.endsWith('.svelte')) {
		// Process .svelte files in routes directory
		if (normalizedFile.includes('src/routes/')) {
			return true;
		}

		// Also process .svelte files in shared component directories that might be used by pages
		if (
			normalizedFile.includes('src/lib/') ||
			normalizedFile.includes('src/components/') ||
			normalizedFile.includes('src/variants/')
		) {
			return true;
		}
	}

	return false;
}

/**
 * Check if file has i18n imports or uses _loadedTranslations
 */
function hasI18nUsage(code: string): boolean {
	// Check for @i18n imports
	const hasImports = I18N_IMPORT_PATTERNS.some((pattern) => code.includes(pattern));

	// Check for _loadedTranslations usage
	const hasLoadedTranslations = code.includes('_loadedTranslations');

	return hasImports || hasLoadedTranslations;
}

/**
 * Generate virtual module content
 */
function generateVirtualModuleContent(runtimePath: string): string {
	const indexPath = resolveFromRoot(runtimePath, 'index');
	return `// Virtual module for @i18n
import * as translations from '${indexPath}';
export * from '${indexPath}';`;
}

/**
 * Generate runtime path - always use @i18n directory
 */
function generateRuntimePath(): string {
	// Always generate in @i18n directory regardless of defaultPath location
	return join('src', 'lib', '@i18n', '_generated', 'messages');
}

/**
 * Check if we're running in a CI environment
 */
function isCI(): boolean {
	return !!(
		process.env.CI ||
		process.env.CONTINUOUS_INTEGRATION ||
		process.env.BUILD_NUMBER ||
		process.env.JENKINS_URL ||
		process.env.GITHUB_ACTIONS ||
		process.env.GITLAB_CI ||
		process.env.CIRCLECI ||
		process.env.TRAVIS ||
		process.env.BUILDKITE ||
		process.env.DRONE ||
		process.env.TF_BUILD
	);
}

/**
 * Add generated messages directory to .gitignore if it exists and entry is not already present
 */
function addToGitignore(messagesPath: string, verbose: boolean): void {
	// Skip in CI environments
	if (isCI()) {
		if (verbose) {
			console.log('🔄 Skipping .gitignore modification in CI environment');
		}
		return;
	}

	const gitignorePath = resolveFromRoot('.gitignore');

	if (!existsSync(gitignorePath)) {
		if (verbose) {
			console.log('📄 No .gitignore file found, skipping automatic addition');
		}
		return;
	}

	try {
		// Read existing .gitignore content
		const gitignoreContent = readFileSync(gitignorePath, 'utf8');
		const lines = gitignoreContent.split('\n');

		// Create the entry to add (with trailing slash to match directory)
		// Use the parent directory (_generated) instead of the full messages path
		const parentDir = messagesPath.replace(/\\/g, '/').replace('/messages', '');
		const entryToAdd = parentDir + '/';

		// Check if the entry already exists (exact match or pattern match)
		const entryExists = lines.some((line) => {
			const trimmedLine = line.trim();
			return (
				trimmedLine === entryToAdd ||
				trimmedLine === parentDir ||
				trimmedLine.includes('_generated')
			);
		});

		if (entryExists) {
			if (verbose) {
				console.log('✅ .gitignore already contains _generated entry');
			}
			return;
		}

		// Add the entry with a comment
		const newLines = [
			...lines,
			'',
			'# Auto-generated by sveltekit-translations-loader',
			entryToAdd
		];

		// Write back to .gitignore
		writeFileSync(gitignorePath, newLines.join('\n'));

		if (verbose) {
			console.log(`✅ Added '${entryToAdd}' to .gitignore`);
		}
	} catch (error) {
		if (verbose) {
			console.warn(
				'⚠️ Failed to update .gitignore:',
				error instanceof Error ? error.message : error
			);
		}
	}
}

/**
 * Process route hierarchy and inject translation keys
 */
async function processRouteHierarchy(
	pageUsages: ReturnType<typeof findPageTranslationUsage>,
	defaultTranslations: Record<string, string>,
	defaultPath: string,
	verbose: boolean,
	isDevelopment: boolean
): Promise<void> {
	// Build route hierarchy to handle nested routes properly
	const routeHierarchy = buildRouteHierarchy(pageUsages);

	// Collect all route data for the RouteKeysMap
	const allRouteData: Array<{
		serverFile: string;
		routePath: string;
		keys: Set<string>;
		functionId: string;
	}> = [];

	// Inject translation keys into each page's server file with accumulated keys
	for (const { serverFile, routePath } of pageUsages) {
		const accumulatedKeys = routeHierarchy.get(routePath) || new Set();
		const resolvedKeys = resolveTranslationKeys(accumulatedKeys, defaultTranslations);

		if (verbose) {
			console.log(`📝 Resolved keys for route ${routePath}:`, Array.from(resolvedKeys));
		}

		// Pass the actual keys to trigger file regeneration with new simplified structure
		const functionId = injectTranslationKeys(serverFile, resolvedKeys, routePath, verbose);

		// Collect route data for RouteKeysMap using the actual functionId from the load function
		if (functionId) {
			allRouteData.push({
				serverFile,
				routePath,
				keys: resolvedKeys,
				functionId // Use the functionId that was actually generated in the load function
			});
		}
	}

	// Update RouteKeysMap with all collected route data
	injectRouteKeysMap(allRouteData, defaultPath, verbose, isDevelopment);

	// Update translations injector
	injectTranslationsInjector(verbose);
}

/**
 * Process all translations and setup
 */
export async function processTranslations(
	state: PluginState,
	defaultPath: string,
	verbose: boolean,
	autoGitignore: boolean,
	consoleNinjaProtection: boolean,
	forceUsageRescan = false
): Promise<void> {
	// Initialize batch file writer with verbose setting and Console Ninja protection
	getGlobalBatchWriter({
		verbose,
		maxRetries: consoleNinjaProtection ? 5 : 1, // Increased retries for persistent Console Ninja
		retryDelay: consoleNinjaProtection ? 100 : 50,
		consoleNinjaGuard: consoleNinjaProtection,
		consoleNinjaRetryDelay: consoleNinjaProtection ? 500 : undefined // Longer delay for Console Ninja
	});

	// Load default translations first to check if they changed
	const newDefaultTranslations = await loadDefaultTranslations(defaultPath);
	const newTranslationsHash = createHash(JSON.stringify(newDefaultTranslations));

	// Check if translations actually changed
	const translationsChanged = state.translationsHash !== newTranslationsHash;

	// Always process if forced usage rescan is requested
	if (forceUsageRescan) {
		if (verbose) {
			console.log('🔄 Forced usage rescan requested - processing all routes');
		}
	} else if (!translationsChanged) {
		if (verbose) {
			console.log('⏭️  Skipping reprocessing - no translation changes detected');
		}
		return;
	}

	if (verbose) {
		if (translationsChanged) {
			console.log('🔄 Translation changes detected, reprocessing...');
		} else if (forceUsageRescan) {
			console.log('🔄 Svelte file changes detected, rescanning usage...');
		}
	}

	// Update state
	state.defaultTranslations = newDefaultTranslations;
	state.translationsHash = newTranslationsHash;

	// Only regenerate translation functions and types if translations changed
	if (translationsChanged) {
		// Generate runtime path - always use @i18n directory (relative for display
		// and .gitignore, absolute for actual filesystem writes anchored to root).
		const runtimePath = generateRuntimePath();
		const runtimeDirAbs = resolveFromRoot(runtimePath);

		// Generate base translation functions
		await generateTranslations(defaultPath, runtimeDirAbs, verbose, state.isDevelopment);

		// Generate TypeScript declarations for the virtual module
		await generateTypeDeclarations(defaultPath, verbose, runtimeDirAbs);

		// Automatically add to .gitignore if enabled
		if (autoGitignore) {
			addToGitignore(runtimePath, verbose);
		} else if (verbose) {
			console.log(`📝 Note: Consider adding '${runtimePath}/' to your .gitignore file`);
		}
	}

	// Always scan for translation usage and auto-inject into load functions
	// This is needed when .svelte files change to use new keys
	const routesDir = resolveFromRoot(ROUTES_DIR);
	const pageUsages = findPageTranslationUsage(routesDir, verbose);

	if (verbose) {
		console.log(`🔍 Found ${pageUsages.length} pages with translation usage`);
	}

	// Process route hierarchy and inject translation keys
	await processRouteHierarchy(
		pageUsages,
		state.defaultTranslations,
		defaultPath,
		verbose,
		state.isDevelopment
	);

	// Force flush all pending file writes
	await forceFlushFileWrites();
}

/**
 * Debounced processing function
 */
function createDebouncedProcessor(
	state: PluginState,
	processTranslationsFn: (forceUsageRescan?: boolean) => Promise<void>,
	verbose: boolean
): (forceUsageRescan?: boolean) => void {
	return (forceUsageRescan = false) => {
		// Clear existing timeout
		if (state.processingTimeout) {
			clearTimeout(state.processingTimeout);
		}

		// Set new timeout
		state.processingTimeout = setTimeout(async () => {
			if (verbose) {
				console.log('🔄 Debounced processing triggered', { forceUsageRescan });
			}
			await processTranslationsFn(forceUsageRescan);
		}, DEBOUNCE_DELAY);
	};
}

/**
 * Setup file watcher for development
 */
function setupFileWatcher(
	server: {
		watcher: {
			add: (path: string) => void;
			on: (event: string, callback: (file: string) => void) => void;
		};
	},
	defaultPath: string,
	state: PluginState,
	processTranslationsFn: () => Promise<void>,
	verbose: boolean,
	includeDirs: string[]
): void {
	// Watch the default translations file
	const resolvedDefaultPath = resolveFromRoot(defaultPath);
	if (verbose) {
		console.log(`👁️  Setting up file watcher for: ${resolvedDefaultPath}`);
	}
	server.watcher.add(resolvedDefaultPath);

	// Watch the routes directory for .svelte file changes
	const routesDir = resolveFromRoot(ROUTES_DIR);
	if (existsSync(routesDir)) {
		// Add the routes directory and all its subdirectories recursively
		server.watcher.add(routesDir);

		// Recursively add all subdirectories, excluding node_modules and other system dirs
		const addSubdirectories = (dir: string) => {
			try {
				const entries = readdirSync(dir);
				for (const entry of entries) {
					const fullPath = join(dir, entry);
					const stat = statSync(fullPath);
					if (stat.isDirectory()) {
						// Skip system directories and node_modules
						if (
							entry === 'node_modules' ||
							entry === '.git' ||
							entry === '.svelte-kit' ||
							entry === 'dist' ||
							entry === 'build' ||
							entry === 'coverage' ||
							entry === '.nyc_output' ||
							entry === '.vscode' ||
							entry === '.idea' ||
							(entry.startsWith('.') && entry !== '@i18n')
						) {
							continue;
						}

						server.watcher.add(fullPath);
						addSubdirectories(fullPath);
					}
				}
			} catch {
				// Ignore errors for directories we can't read
			}
		};

		addSubdirectories(routesDir);
	}

	// Also watch for components outside routes that might be used by page components
	const projectRoot = getProjectRoot();
	const srcDir = join(projectRoot, 'src');

	if (existsSync(srcDir)) {
		// Dynamically discover shared component directories based on SvelteKit config and common patterns
		const sharedDirs: string[] = [];

		// Add configured include directories that exist and stay inside the project root
		includeDirs.forEach((dirName) => {
			const dirPath = join(srcDir, dirName);
			if (existsSync(dirPath) && isInsideProjectRoot(dirPath)) {
				sharedDirs.push(dirPath);
			}
		});

		// Add directories from SvelteKit aliases that point to src/ subdirectories
		const svelteKitConfig = loadSvelteKitConfig(verbose);
		if (svelteKitConfig.kit?.alias) {
			Object.entries(svelteKitConfig.kit.alias).forEach(([alias, path]) => {
				// Check if the alias points to a src/ subdirectory
				if (path.startsWith('./src/') || path.startsWith('src/')) {
					const aliasPath = path.startsWith('./') ? path.slice(2) : path;
					const fullPath = join(projectRoot, aliasPath);
					// Never watch a directory that resolves outside the project root.
					if (
						existsSync(fullPath) &&
						isInsideProjectRoot(fullPath) &&
						!sharedDirs.includes(fullPath)
					) {
						sharedDirs.push(fullPath);
						if (verbose) {
							console.log(`👁️  Added alias directory: ${alias} -> ${fullPath}`);
						}
					} else if (verbose && !isInsideProjectRoot(fullPath)) {
						console.log(`🚫 Ignoring alias '${alias}' -> outside project root: ${fullPath}`);
					}
				}
			});
		}

		// Watch all discovered shared component directories
		sharedDirs.forEach((dir) => {
			server.watcher.add(dir);
			if (verbose) {
				console.log(`👁️  Watching shared components directory: ${dir}`);
			}

			// Recursively add subdirectories, excluding node_modules and other system dirs
			const addSharedSubdirectories = (sharedDir: string) => {
				try {
					const entries = readdirSync(sharedDir);
					for (const entry of entries) {
						const fullPath = join(sharedDir, entry);
						const stat = statSync(fullPath);
						if (stat.isDirectory()) {
							// Skip system directories and node_modules
							if (
								entry === 'node_modules' ||
								entry === '.git' ||
								entry === '.svelte-kit' ||
								entry === 'dist' ||
								entry === 'build' ||
								entry === 'coverage' ||
								entry === '.nyc_output' ||
								entry === '.vscode' ||
								entry === '.idea' ||
								(entry.startsWith('.') && entry !== '@i18n')
							) {
								continue;
							}

							server.watcher.add(fullPath);
							addSharedSubdirectories(fullPath);
						}
					}
				} catch {
					// Ignore errors for directories we can't read
				}
			};

			addSharedSubdirectories(dir);
		});
	}

	// Create debounced processor with shorter delay for better responsiveness
	const debouncedProcessor = createDebouncedProcessor(state, processTranslationsFn, verbose);

	server.watcher.on('change', async (file: string) => {
		if (verbose) {
			console.log(`📝 File changed: ${file}`);
		}
		// Apply filtering to prevent unnecessary reprocessing
		if (shouldReprocessFile(file, defaultPath)) {
			// Check if this is a translation file change or svelte file change
			const isTranslationFile = file.includes(defaultPath);
			const isSvelteFile = file.endsWith('.svelte');

			// For .svelte files, process them and let the dependency tracker handle filtering
			if (isSvelteFile) {
				try {
					const content = readFileSync(file, 'utf8');
					const hasUsage = hasI18nUsage(content);

					if (verbose) {
						console.log(`📝 .svelte file changed: ${basename(file)}`);
						console.log(`🔍 Has i18n usage: ${hasUsage}`);
					}

					// Add delay to let Console Ninja finish any pending injections before processing
					await new Promise((resolve) => setTimeout(resolve, 200));

					// Handle component change with dependency tracking
					// The dependency tracker will check if this component or its users have translation usage
					await handleComponentChange(file, ROUTES_DIR, verbose);

					// Also trigger normal reprocessing to ensure everything is up to date
					if (verbose) {
						console.log(`🔄 Triggering usage rescan for ${basename(file)}`);
					}
					debouncedProcessor(true);
					return;
				} catch (error) {
					if (verbose) {
						console.log(
							`⚠️  Could not read ${basename(file)}, proceeding with reprocessing:`,
							error
						);
					}
					// If we can't read the file, proceed with reprocessing to be safe
					debouncedProcessor(true);
					return;
				}
			}

			if (verbose) {
				const changeType = isTranslationFile ? 'translation' : 'usage';
				console.log(
					`🔄 Detected ${changeType} change in ${basename(file)}, scheduling reprocessing...`
				);
			}

			// Force usage rescan for .svelte files, normal processing for translation changes
			if (isSvelteFile) {
				debouncedProcessor(true); // Force usage rescan for .svelte files
			} else {
				debouncedProcessor(false); // Normal processing for translation changes
			}
		}
	});

	// Listen to new file additions
	server.watcher.on('add', async (file: string) => {
		if (file.endsWith('.svelte') && shouldReprocessFile(file, defaultPath)) {
			try {
				const content = readFileSync(file, 'utf8');
				const hasUsage = hasI18nUsage(content);

				if (verbose) {
					console.log(`➕ New .svelte file detected: ${basename(file)}`);
					console.log(`🔍 Has i18n usage: ${hasUsage}`);
				}

				// Handle component change with dependency tracking for new files
				// The dependency tracker will check if this component or its users have translation usage
				await handleComponentChange(file, ROUTES_DIR, verbose);

				// Always trigger reprocessing for new .svelte files
				if (verbose) {
					console.log(`🔄 Triggering usage rescan for new file ${basename(file)}`);
				}
				debouncedProcessor(true);
			} catch (error) {
				if (verbose) {
					console.log(
						`⚠️  Could not read new file ${basename(file)}, proceeding with reprocessing:`,
						error
					);
				}
				// If we can't read the file, proceed with reprocessing to be safe
				debouncedProcessor(true);
			}
		}
	});

	// Listen to file deletions (in case a component is removed)
	server.watcher.on('unlink', async (file: string) => {
		if (file.endsWith('.svelte') && shouldReprocessFile(file, defaultPath)) {
			if (verbose) {
				console.log(`🗑️  .svelte file removed: ${basename(file)}, scheduling usage rescan...`);
			}

			// Handle component change with dependency tracking for deleted files
			// This will update server files that were using the deleted component
			await handleComponentChange(file, ROUTES_DIR, verbose);

			// Force usage rescan when .svelte files are removed
			debouncedProcessor(true);
		}
	});
}

/**
 * Load SvelteKit config from the project
 */
function loadSvelteKitConfig(verbose = false): { kit?: { alias?: Record<string, string> } } {
	try {
		const svelteConfigPath = resolveFromRoot('svelte.config.js');
		if (existsSync(svelteConfigPath)) {
			// Read and parse the svelte.config.js file
			const configContent = readFileSync(svelteConfigPath, 'utf8');

			// Handle both ES modules and CommonJS syntax
			// Look for alias configuration in the config object
			const aliasMatch = configContent.match(/alias:\s*\{([^}]+)\}/);
			if (aliasMatch) {
				const aliasContent = aliasMatch[1];
				const aliases: Record<string, string> = {};

				// Parse aliases like '@variants': './src/variants'
				const aliasRegex = /['"]([^'"]+)['"]:\s*['"]([^'"]+)['"]/g;
				let match;
				while ((match = aliasRegex.exec(aliasContent)) !== null) {
					aliases[match[1]] = match[2];
				}

				if (Object.keys(aliases).length > 0) {
					if (verbose) {
						console.log('🔧 Loaded SvelteKit aliases:', aliases);
					}
					return { kit: { alias: aliases } };
				}
			}
		}
	} catch (error) {
		console.warn('Could not load SvelteKit config:', error);
	}

	return {};
}

/**
 * Main plugin function
 */
export function sveltekitTranslationsImporterPlugin(options: PluginConfig): Plugin {
	const { defaultPath, verbose = false, autoGitignore = true } = options;
	const includeDirs = options.includeDirs ?? [...DEFAULT_INCLUDE_DIRS];

	// Anchor the plugin to an explicit root immediately if provided. Vite's
	// resolved `config.root` overrides this later (authoritative).
	if (options.root) {
		setProjectRoot(options.root);
	}

	// Initialize plugin state
	const state: PluginState = {
		isBuildMode: false,
		isDevelopment: detectDevelopmentMode(),
		defaultTranslations: {},
		processingTimeout: null,
		lastProcessedFiles: new Set(),
		translationsHash: '',
		viteConfig: { command: '', mode: '' } // Initialize viteConfig
	};

	// Load SvelteKit config immediately when plugin is created
	const svelteKitConfig = loadSvelteKitConfig(verbose);
	if (svelteKitConfig.kit?.alias) {
		setSvelteKitConfig(svelteKitConfig);
		// Only log if verbose is enabled
		if (verbose) {
			console.log('🔧 Plugin initialized with SvelteKit aliases:', svelteKitConfig.kit.alias);
		}
	}

	// Create processTranslations function with current state
	const processTranslationsFn = (forceUsageRescan = false) =>
		processTranslations(
			state,
			defaultPath,
			verbose,
			autoGitignore,
			options.consoleNinjaProtection ?? true,
			forceUsageRescan
		);

	return {
		name: 'sveltekit-translations-loader',

		async config(userConfig: { root?: string }) {
			// Anchor to the project root as early as possible so the very first
			// scan/generate pass stays inside this package (important in monorepos).
			setProjectRoot(options.root ?? userConfig?.root ?? process.cwd());

			// Ensure messages are generated before any other plugins try to resolve them
			await processTranslationsFn();
		},

		configResolved(config: BuildConfig) {
			// Detect if we're in production build mode
			state.isBuildMode = config.command === 'build' && config.mode === 'production';
			state.viteConfig = config; // Store Vite config

			// Vite's resolved root is authoritative. Pin everything the plugin does
			// to it so sibling packages in a monorepo are never touched.
			setProjectRoot(options.root ?? config.root ?? process.cwd());

			// Set Vite config for alias resolution in scanner
			setViteConfig(config);

			// Automatically load and set SvelteKit config for alias resolution
			const svelteKitConfig = loadSvelteKitConfig(verbose);
			if (svelteKitConfig.kit?.alias) {
				setSvelteKitConfig(svelteKitConfig);
				if (verbose) {
					console.log('🔧 Auto-configured SvelteKit aliases:', svelteKitConfig.kit.alias);
				}
			}

			if (verbose) {
				console.log(
					`🔍 Mode detected: ${config.command} (mode: ${config.mode}, isBuildMode: ${state.isBuildMode})`
				);
			}
		},

		async buildStart() {
			// Process translations and auto-inject into load functions
			await processTranslationsFn();
		},

		configureServer(server: ViteDevServer) {
			// `configureServer` only runs for the dev server (command === 'serve'),
			// so the watcher is always wired up here for development.
			setupFileWatcher(server, defaultPath, state, processTranslationsFn, verbose, includeDirs);
		},

		resolveId(id: string) {
			if (id === VIRTUAL_MODULE_ID) {
				// Return virtual module ID for the translations loader
				return VIRTUAL_MODULE_INTERNAL_ID;
			}
			return null;
		},

		load(id: string) {
			if (id === VIRTUAL_MODULE_INTERNAL_ID) {
				// Generate runtime path - always use @i18n directory
				const runtimePath = generateRuntimePath();
				// Return the content that should be loaded for the virtual module
				return generateVirtualModuleContent(runtimePath);
			}
			return null;
		},

		transform() {
			return null;
		},

		async closeBundle() {
			// Clean up timeout when plugin is destroyed
			if (state.processingTimeout) {
				clearTimeout(state.processingTimeout);
				state.processingTimeout = null;
			}

			// Force flush any remaining file writes only during build
			if (state.isBuildMode) {
				await forceFlushFileWrites();
			}
		}
	};
}

/**
 * Set both Vite and SvelteKit configurations for comprehensive alias support
 * This function should be called in your plugin setup to enable alias resolution
 * from both vite.config.js and svelte.config.js
 */
export function setPluginConfigs(
	viteConfig: {
		alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
		resolve?: {
			alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
		};
	},
	svelteKitConfig: { kit?: { alias?: Record<string, string> } }
): void {
	// Set Vite config for alias resolution
	if (viteConfig?.alias || viteConfig?.resolve?.alias) {
		setViteConfig(viteConfig);
	}

	// Set SvelteKit config for alias resolution
	if (svelteKitConfig?.kit?.alias) {
		setSvelteKitConfig(svelteKitConfig);
	}
}

// Export transform function for use in server hooks
export { transformTranslationCode };
