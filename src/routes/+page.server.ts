import type { PageServerLoad } from './$types.js';
// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from 'sveltekit-translations-loader/server';
const _translationKeys: string[] = [
	'pageTitle',
	'hello',
	'welcome',
	'user-count',
	'pageContent',
	'goodbye',
	'layoutDescription'
];
// END AUTO-GENERATED CODE
// =============================================================================

const customFunction = () => {
	return 'This is custom code that should be preserved';
};
const customVariable = 'custom value';

export const load: PageServerLoad = async () => {
	return {
		customFunction: customFunction(),
		customVariable,
		_loadedTranslations: _getTranslations(_translationKeys)
	};
};
