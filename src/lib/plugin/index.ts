import { basename, resolve } from 'path';
import type { Plugin } from 'vite';

// Import from separated modules
import { generateTranslations } from './function-generator.js';
import { resolveTranslationKeys, transformTranslationCode } from './helpers.js';
import { injectTranslationKeys } from './load-function-updater.js';
import { buildRouteHierarchy, findPageTranslationUsage } from './scanner.js';
import { generateTypeDeclarations } from './type-generator.js';

export interface PluginConfig {
	defaultPath: string;
	runtimePath: string;
	verbose?: boolean;
}

export function sveltekitTranslationsImporterPlugin(options: PluginConfig): Plugin {
	const { defaultPath, runtimePath, verbose = false } = options;

	async function processTranslations() {
		// Generate base translation functions
		await generateTranslations(defaultPath, runtimePath, verbose);

		// Generate TypeScript declarations for the virtual module
		await generateTypeDeclarations(defaultPath, verbose, runtimePath);

		// Load default translations to resolve keys properly
		const translationsPath = resolve(defaultPath);
		const translationsModule = await import(`file://${translationsPath}?t=${Date.now()}`);
		const defaultTranslations = translationsModule.default || translationsModule;

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
	}

	return {
		name: 'sveltekit-translations-loader',

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
			if (id === '@sveltekit-translations-loader') {
				// Return virtual module ID for the translations loader
				return '\0@sveltekit-translations-loader';
			}

			return null;
		},

		load(id) {
			if (id === '\0@sveltekit-translations-loader') {
				// Return the content that should be loaded for the virtual module
				return `// Virtual module for @sveltekit-translations-loader
export * from '${resolve(runtimePath)}';`;
			}

			return null;
		}
	};
}
// Export transform function for use in server hooks
export { transformTranslationCode };
