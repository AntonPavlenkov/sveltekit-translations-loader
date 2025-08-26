import type { LayoutServerLoad } from './$types.js';

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/.translations/_generated/server/translations-injector';
const _functionId = 'owmc5p89dem';
// END AUTO-GENERATED CODE

export const load: LayoutServerLoad = async ({ locals }) => {
	// Get user's locale from locals (set by server hook)
	const userLocale = locals.locale;
	const availableLocales = locals.translationsManager.getLocales();

	return {
		translationsTabId: locals.translationsTabId,
		locale: userLocale,
		availableLocales,
		_loadedTranslations: _getTranslations(_functionId)
	};
};
