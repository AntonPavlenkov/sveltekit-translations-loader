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

export function sveltekitTranslationsImporterPlugin(options: PluginConfig): Plugin {
	const { defaultPath, runtimePath, verbose = false, removeFunctionsOnBuild = false } = options;

	// Log build optimization info
	if (removeFunctionsOnBuild && verbose) {
		console.log('🚀 removeFunctionsOnBuild enabled - optimizing client-side translations');
	}

	// Auto-detect if we're in development mode for the library itself
	// This checks if we're working on the library source code, not using it as a package
	const isDevelopment =
		process.cwd().includes('sveltekit-translations-loader') &&
		existsSync(resolve('src/lib/helpers/utils.ts'));

	let isBuildMode = false;
	let defaultTranslations: Record<string, string> = {};

	async function processTranslations() {
		// Generate base translation functions
		await generateTranslations(defaultPath, runtimePath, verbose, isDevelopment);

		// Generate TypeScript declarations for the virtual module
		await generateTypeDeclarations(defaultPath, verbose, runtimePath);

		// Load default translations to resolve keys properly
		const translationsPath = resolve(defaultPath);
		const translationsModule = await import(`file://${translationsPath}?t=${Date.now()}`);
		defaultTranslations = translationsModule.default || translationsModule;

		// Scan for translation usage and auto-inject into load functions
		const routesDir = resolve('src/routes');
		const pageUsages = findPageTranslationUsage(routesDir);

		if (verbose) {
			console.log(`🔍 Found ${pageUsages.length} pages with translation usage`);
		}

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

		// Note: Svelte file transformation is now handled in the transform hook
		// to avoid modifying source files and only affect build output
	}

	return {
		name: 'sveltekit-translations-loader',

		configResolved(config) {
			// Detect if we're in production build mode
			isBuildMode = config.command === 'build' && config.mode === 'production';
			if (verbose) {
				console.log(
					`🔍 Mode detected: ${config.command} (mode: ${config.mode}, isBuildMode: ${isBuildMode})`
				);
			}
		},

		async buildStart() {
			// Process translations and auto-inject into load functions
			await processTranslations();
		},

		configureServer(server) {
			// Watch for changes in development
			server.watcher.add(resolve(defaultPath));
			server.watcher.add(resolve('src/routes'));

			server.watcher.on('change', async (file) => {
				if (
					file.includes(defaultPath) ||
					(file.includes('src/routes') && file.endsWith('.svelte'))
				) {
					if (verbose) {
						console.log(`🔄 Detected change in ${basename(file)}, reprocessing translations...`);
					}
					await processTranslations();
				}
			});
		},

		resolveId(id) {
			if (id === '@i18n') {
				// Return virtual module ID for the translations loader
				return '\0@i18n';
			}

			return null;
		},

		load(id) {
			if (id === '\0@i18n') {
				// Return the content that should be loaded for the virtual module
				return `// Virtual module for @i18n
export * from '${resolve(runtimePath)}';`;
			}

			return null;
		},

		transform(code, id, options) {
			// Only transform .svelte files when removeFunctionsOnBuild is enabled and we're in build mode
			if (removeFunctionsOnBuild && isBuildMode && id.endsWith('.svelte')) {
				// Enhanced SSR detection - check multiple indicators
				const isSSR =
					options?.ssr === true ||
					id.includes('.svelte-kit/generated/server/') ||
					id.includes('?ssr') ||
					process.env.VITE_SSR === 'true';

				// Only transform for client builds, not SSR
				if (!isSSR) {
					// Check if the file contains @i18n imports
					if (
						code.includes("import * as t from '@i18n'") ||
						code.includes('import * as t from "@i18n"')
					) {
						if (verbose) {
							console.log(
								`🔄 Transforming ${id.replace(process.cwd(), '.')} for client build only`
							);
						}

						try {
							const transformedCode = transformSvelteContent(code, defaultTranslations, verbose);
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
				} else if (verbose) {
					console.log(`⏭️  Skipping SSR transformation for ${id.replace(process.cwd(), '.')}`);
				}
			}

			return null;
		}
	};
}
// Export transform function for use in server hooks
export { transformTranslationCode };
