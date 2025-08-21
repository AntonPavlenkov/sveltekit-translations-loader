import type { PageServerLoad } from './$types.js';

const customFunction = () => {
	return 'This is custom code that should be preserved';
};
const customVariable = 'custom value';

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = [
	'pageTitle',
	'hello',
	'welcome',
	'user-count',
	'goodbye',
	'layoutDescription'
];
// END AUTO-GENERATED CODE

export const load: PageServerLoad = async () => {
	return {
		customFunction: customFunction(),
		customVariable,
		_loadedTranslations: _getTranslations(_translationKeys)
	};
};
