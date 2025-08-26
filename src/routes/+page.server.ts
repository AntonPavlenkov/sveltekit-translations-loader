import type { PageServerLoad } from './$types.js';

const customFunction = () => {
	return 'This is custom code that should be preserved';
};
const customVariable = 'custom value';

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/.translations/_generated/server/translations-injector';
const _functionId = 'dr0fh5kk5y';
// END AUTO-GENERATED CODE

export const load: PageServerLoad = async () => {
	return {
		customFunction: customFunction(),
		customVariable,
		_loadedTranslations: _getTranslations(_functionId)
	};
};
