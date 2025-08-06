import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { basename, join, resolve } from 'path';
import type { Plugin } from 'vite';

// Import from separated modules
import { generateTranslations } from './function-generator.js';
import { resolveTranslationKeys, transformTranslationCode } from './helpers.js';
import { injectTranslationKeys } from './load-function-updater.js';
import { buildRouteHierarchy, findPageTranslationUsage, setViteConfig } from './scanner.js';
import { transformSvelteContent } from './svelte-transformer.js';
import { generateTypeDeclarations } from './type-generator.js';

// Constants
const VIRTUAL_MODULE_ID = '@i18n';
const VIRTUAL_MODULE_INTERNAL_ID = '\0@i18n';

const I18N_IMPORT_PATTERNS = ["import * as t from '@i18n'", 'import * as t from "@i18n"'] as const;

const SSR_INDICATORS = ['.svelte-kit/generated/server/', '?ssr'] as const;

const ROUTES_DIR = 'src/routes';
const HELPERS_UTILS_PATH = 'src/lib/helpers/utils.ts';

// Debouncing constants
const DEBOUNCE_DELAY = 100; // 100ms debounce delay for better responsiveness

// Types
export interface PluginConfig {
	defaultPath: string;
	runtimePath: string;
	verbose?: boolean;
	/**
	 * Remove @i18n imports during build and replace with direct page.data access for better performance.
	 * Only affects client-side builds, server-side rendering uses original translation functions.
	 * @default false
	 */
	removeFunctionsOnBuild?: boolean;
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
	alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
	resolve?: {
		alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
	};
}

interface TransformOptions {
	ssr?: boolean;
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

/**
 * Create a simple hash from a string
 */
function createHash(content: string): string {
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return hash.toString();
}

/**
 * Load default translations from the specified path
 */
async function loadDefaultTranslations(defaultPath: string): Promise<Record<string, string>> {
	const translationsPath = resolve(defaultPath);
	const translationsModule = await import(`file://${translationsPath}?t=${Date.now()}`);
	return translationsModule.default || translationsModule;
}

/**
 * Check if file should trigger reprocessing
 */
function shouldReprocessFile(file: string, defaultPath: string): boolean {
	// Skip generated, temporary, or system files to prevent loops
	if (
		file.includes('.svelte-kit/') ||
		file.includes('node_modules/') ||
		file.includes('.tmp') ||
		file.includes('.bak') ||
		file.includes('~') ||
		file.includes('$types.ts') ||
		file.includes('.d.ts')
	) {
		return false;
	}

	// Process translation files and .svelte files in routes directory
	// Note: We don't exclude server files anymore as they need to be updated when components change
	return file.includes(defaultPath) || (file.includes(ROUTES_DIR) && file.endsWith('.svelte'));
}

/**
 * Check if file has i18n imports
 */
function hasI18nImports(code: string): boolean {
	return I18N_IMPORT_PATTERNS.some((pattern) => code.includes(pattern));
}

/**
 * Check if transformation is for SSR
 */
function isSSRTransformation(id: string, options?: TransformOptions): boolean {
	return (
		options?.ssr === true ||
		SSR_INDICATORS.some((indicator) => id.includes(indicator)) ||
		process.env.VITE_SSR === 'true'
	);
}

/**
 * Generate virtual module content
 */
function generateVirtualModuleContent(runtimePath: string): string {
	return `// Virtual module for @i18n
export * from '${resolve(runtimePath)}';`;
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

	// Inject translation keys into each page's server file with accumulated keys
	for (const { serverFile, routePath } of pageUsages) {
		const accumulatedKeys = routeHierarchy.get(routePath) || new Set();
		const resolvedKeys = resolveTranslationKeys(accumulatedKeys, defaultTranslations);

		if (verbose) {
			console.log(`📝 Resolved keys for route ${routePath}:`, Array.from(resolvedKeys));
		}

		injectTranslationKeys(serverFile, resolvedKeys, routePath, defaultPath, verbose, isDevelopment);
	}
}

/**
 * Process all translations and setup
 */
async function processTranslations(
	state: PluginState,
	defaultPath: string,
	runtimePath: string,
	verbose: boolean,
	forceUsageRescan = false
): Promise<void> {
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
		// Generate base translation functions
		await generateTranslations(defaultPath, runtimePath, verbose, state.isDevelopment);

		// Generate TypeScript declarations for the virtual module
		await generateTypeDeclarations(defaultPath, verbose, runtimePath);
	}

	// Always scan for translation usage and auto-inject into load functions
	// This is needed when .svelte files change to use new keys
	const routesDir = resolve(ROUTES_DIR);
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
				console.log('🔄 Debounced processing triggered');
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
	verbose: boolean
): void {
	// Watch the default translations file
	server.watcher.add(resolve(defaultPath));

	// Watch the routes directory for .svelte file changes
	const routesDir = resolve(ROUTES_DIR);
	if (existsSync(routesDir)) {
		// Add the routes directory and all its subdirectories recursively
		server.watcher.add(routesDir);

		// Recursively add all subdirectories
		function addSubdirectories(dir: string) {
			try {
				const entries = readdirSync(dir);
				for (const entry of entries) {
					const fullPath = join(dir, entry);
					const stat = statSync(fullPath);
					if (stat.isDirectory()) {
						server.watcher.add(fullPath);
						addSubdirectories(fullPath);
					}
				}
			} catch {
				// Ignore errors for directories we can't read
			}
		}

		addSubdirectories(routesDir);
	}

	// Create debounced processor with shorter delay for better responsiveness
	const debouncedProcessor = createDebouncedProcessor(state, processTranslationsFn, verbose);

	server.watcher.on('change', async (file: string) => {
		// Apply filtering to prevent unnecessary reprocessing
		if (shouldReprocessFile(file, defaultPath)) {
			// Check if this is a translation file change or svelte file change
			const isTranslationFile = file.includes(defaultPath);
			const isSvelteFile = file.endsWith('.svelte');

			// For .svelte files, always trigger reprocessing regardless of i18n imports
			// This ensures we catch all changes and update server files properly
			if (isSvelteFile) {
				try {
					const content = readFileSync(file, 'utf8');
					const hasImports = hasI18nImports(content);

					if (verbose) {
						console.log(`📝 .svelte file changed: ${basename(file)}`);
						console.log(`🔍 Has i18n imports: ${hasImports}`);
					}

					// Always trigger reprocessing for .svelte files to ensure server files are updated
					// Even if no i18n imports are found, we need to rescan in case imports were removed
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

			// Force usage rescan for .svelte file changes, normal processing for translation changes
			debouncedProcessor(isSvelteFile);
		}
	});

	// Listen to new file additions
	server.watcher.on('add', async (file: string) => {
		if (
			file.endsWith('.svelte') &&
			file.includes(ROUTES_DIR) &&
			shouldReprocessFile(file, defaultPath)
		) {
			try {
				const content = readFileSync(file, 'utf8');
				const hasImports = hasI18nImports(content);

				if (verbose) {
					console.log(`➕ New .svelte file detected: ${basename(file)}`);
					console.log(`🔍 Has i18n imports: ${hasImports}`);
				}

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
		if (
			file.endsWith('.svelte') &&
			file.includes(ROUTES_DIR) &&
			shouldReprocessFile(file, defaultPath)
		) {
			if (verbose) {
				console.log(`🗑️  .svelte file removed: ${basename(file)}, scheduling usage rescan...`);
			}
			// Force usage rescan when .svelte files are removed
			debouncedProcessor(true);
		}
	});
}

/**
 * Transform Svelte file content
 */
function transformSvelteFile(
	code: string,
	id: string,
	state: PluginState,
	verbose: boolean
): { code: string; map: null } | null {
	// Check if the file contains @i18n imports
	if (!hasI18nImports(code)) {
		return null;
	}

	if (verbose) {
		console.log(`🔄 Transforming ${id.replace(process.cwd(), '.')} for client build only`);
	}

	try {
		const transformedCode = transformSvelteContent(code, state.defaultTranslations, verbose);
		return {
			code: transformedCode,
			map: null // Could add source map support here if needed
		};
	} catch (error) {
		if (verbose) {
			console.error(`❌ Error transforming ${id}:`, error);
		}
		// Return original code if transformation fails
		return null;
	}
}

/**
 * Handle transform hook for Svelte files
 */
function handleTransform(
	code: string,
	id: string,
	options: TransformOptions | undefined,
	state: PluginState,
	removeFunctionsOnBuild: boolean,
	verbose: boolean
): { code: string; map: null } | null {
	// Only transform .svelte files when removeFunctionsOnBuild is enabled and we're in build mode
	if (!removeFunctionsOnBuild || !state.isBuildMode || !id.endsWith('.svelte')) {
		return null;
	}

	// Enhanced SSR detection - check multiple indicators
	const isSSR = isSSRTransformation(id, options);

	// Only transform for client builds, not SSR
	if (isSSR) {
		if (verbose) {
			console.log(`⏭️  Skipping SSR transformation for ${id.replace(process.cwd(), '.')}`);
		}
		return null;
	}

	return transformSvelteFile(code, id, state, verbose);
}

/**
 * Main plugin function
 */
export function sveltekitTranslationsImporterPlugin(options: PluginConfig): Plugin {
	const { defaultPath, runtimePath, verbose = false, removeFunctionsOnBuild = false } = options;

	// Log build optimization info
	if (removeFunctionsOnBuild && verbose) {
		console.log('🚀 removeFunctionsOnBuild enabled - optimizing client-side translations');
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

	// Create processTranslations function with current state
	const processTranslationsFn = (forceUsageRescan = false) =>
		processTranslations(state, defaultPath, runtimePath, verbose, forceUsageRescan);

	return {
		name: 'sveltekit-translations-loader',

		configResolved(config: BuildConfig) {
			// Detect if we're in production build mode
			state.isBuildMode = config.command === 'build' && config.mode === 'production';
			state.viteConfig = config; // Store Vite config

			// Set Vite config for alias resolution in scanner
			setViteConfig(config);

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

		configureServer(server) {
			// Setup file watcher for development
			setupFileWatcher(server, defaultPath, state, processTranslationsFn, verbose);
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
				// Return the content that should be loaded for the virtual module
				return generateVirtualModuleContent(runtimePath);
			}
			return null;
		},

		transform(code: string, id: string, options?: TransformOptions) {
			return handleTransform(code, id, options, state, removeFunctionsOnBuild, verbose);
		},

		closeBundle() {
			// Clean up timeout when plugin is destroyed
			if (state.processingTimeout) {
				clearTimeout(state.processingTimeout);
				state.processingTimeout = null;
			}
		}
	};
}

// Export transform function for use in server hooks
export { transformTranslationCode };
