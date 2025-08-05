import { existsSync } from 'fs';
import { basename, resolve } from 'path';
import type { Plugin } from 'vite';

// Import from separated modules
import { generateTranslations } from './function-generator.js';
import { resolveTranslationKeys, transformTranslationCode } from './helpers.js';
import { injectTranslationKeys } from './load-function-updater.js';
import { buildRouteHierarchy, findPageTranslationUsage } from './scanner.js';
import { transformSvelteContent } from './svelte-transformer.js';
import { generateTypeDeclarations } from './type-generator.js';

// Constants
const VIRTUAL_MODULE_ID = '@i18n';
const VIRTUAL_MODULE_INTERNAL_ID = '\0@i18n';

const I18N_IMPORT_PATTERNS = ["import * as t from '@i18n'", 'import * as t from "@i18n"'] as const;

const SSR_INDICATORS = ['.svelte-kit/generated/server/', '?ssr'] as const;

const ROUTES_DIR = 'src/routes';
const HELPERS_UTILS_PATH = 'src/lib/helpers/utils.ts';

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
}

interface BuildConfig {
	command: string;
	mode: string;
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
	verbose: boolean
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

		injectTranslationKeys(serverFile, resolvedKeys, routePath, defaultPath, verbose);
	}
}

/**
 * Process all translations and setup
 */
async function processTranslations(
	state: PluginState,
	defaultPath: string,
	runtimePath: string,
	verbose: boolean
): Promise<void> {
	// Generate base translation functions
	await generateTranslations(defaultPath, runtimePath, verbose, state.isDevelopment);

	// Generate TypeScript declarations for the virtual module
	await generateTypeDeclarations(defaultPath, verbose, runtimePath);

	// Load default translations to resolve keys properly
	state.defaultTranslations = await loadDefaultTranslations(defaultPath);

	// Scan for translation usage and auto-inject into load functions
	const routesDir = resolve(ROUTES_DIR);
	const pageUsages = findPageTranslationUsage(routesDir);

	if (verbose) {
		console.log(`🔍 Found ${pageUsages.length} pages with translation usage`);
	}

	// Process route hierarchy and inject translation keys
	await processRouteHierarchy(pageUsages, state.defaultTranslations, defaultPath, verbose);
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
	// Watch for changes in development
	server.watcher.add(resolve(defaultPath));
	server.watcher.add(resolve(ROUTES_DIR));

	server.watcher.on('change', async (file: string) => {
		if (shouldReprocessFile(file, defaultPath)) {
			if (verbose) {
				console.log(`🔄 Detected change in ${basename(file)}, reprocessing translations...`);
			}
			await processTranslationsFn();
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
		defaultTranslations: {}
	};

	// Create processTranslations function with current state
	const processTranslationsFn = () => processTranslations(state, defaultPath, runtimePath, verbose);

	return {
		name: 'sveltekit-translations-loader',

		configResolved(config: BuildConfig) {
			// Detect if we're in production build mode
			state.isBuildMode = config.command === 'build' && config.mode === 'production';

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
		}
	};
}

// Export transform function for use in server hooks
export { transformTranslationCode };
