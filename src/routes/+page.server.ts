import type { PageServerLoad } from './$types.js';
// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from 'sveltekit-translations-loader/server';
const _translationKeys: string[] = ['welcome', 'user-count', 'nested-params', 'hello', 'goodbye'];
// END AUTO-GENERATED CODE
// =============================================================================

// Custom code - this should be preserved
const customFunction = () => {
	return 'This is custom code that should be preserved';
};
// More custom code
const customVariable = 'custom value';

export const load: PageServerLoad = async () => {
	return {
		customFunction: customFunction(),
		customVariable,
		_loadedTranslations: _getTranslations(_translationKeys)
	};
};
