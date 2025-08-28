import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { queueFileWrite } from './batch-file-writer.js';

// Constants
const getTranslationsInjectorPath = (): string => {
	const basePath = 'src/lib/@i18n/_generated/server';
	return `${basePath}/translations-injector.ts`;
};

const AUTO_GENERATED_MARKERS = {
	START: '// =============================================================================',
	HEADER: '// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN',
	END: '// END AUTO-GENERATED CODE'
} as const;

/**
 * Generate the translations injector content
 */
function generateTranslationsInjectorContent(): string {
	return `// ${AUTO_GENERATED_MARKERS.START}
// ${AUTO_GENERATED_MARKERS.HEADER}
// Generated at: ${new Date().toISOString()}
// ${AUTO_GENERATED_MARKERS.START}

import { getRequestEvent } from '$app/server';
import RouteKeysMap from './route-keys-map.js';

export function _getTranslations(functionId: string) {
	const { locals } = getRequestEvent();
	const routeKeys = RouteKeysMap.get(functionId) || [];
	const isSentAlready = locals.translationsCookies[functionId] || false;

	const allTranslations = locals.translationsManager.getTranslations(locals.locale);
	let newTranslationsData = {
		...(locals._translationsData || {}),
		...(locals.extraKeys || {})
	};
	if (!isSentAlready && locals.translationsManager.useCookie || !locals.translationsManager.useCookie) {
		newTranslationsData = {
			...routeKeys.reduce(
				(acc, key) => ({ ...acc, [key]: allTranslations[key] || \`(\${key} missing)\` }),
				{}
			),
			...newTranslationsData
		};
		if (locals.translationsManager.useCookie)
			locals.translationsManager.setCookiesWithData(functionId);
	}

	return (locals._translationsData = newTranslationsData);
}

// ${AUTO_GENERATED_MARKERS.END}
`;
}

/**
 * Update the translations injector file
 */
function updateTranslationsInjectorFile(verbose: boolean = false): void {
	const injectorPath = resolve(getTranslationsInjectorPath());
	const newContent = generateTranslationsInjectorContent();

	// Ensure the directory exists
	const injectorDir = dirname(injectorPath);
	if (!existsSync(injectorDir)) {
		// Create directory if it doesn't exist
		try {
			mkdirSync(injectorDir, { recursive: true });
		} catch (error) {
			console.error(`❌ Failed to create directory ${injectorDir}:`, error);
			return;
		}
	}

	// Queue the file write
	queueFileWrite(injectorPath, newContent, { encoding: 'utf8' });

	if (verbose) {
		console.log(`✅ Updated ${getTranslationsInjectorPath()}`);
	}
}

/**
 * Inject or update the translations injector
 */
export function injectTranslationsInjector(verbose: boolean = false): void {
	if (verbose) {
		console.log(`🔧 injectTranslationsInjector called`);
		console.log(`🔧 TranslationsInjector path: ${getTranslationsInjectorPath()}`);
	}

	updateTranslationsInjectorFile(verbose);
}
