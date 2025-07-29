import { getRequestEvent } from '$app/server';
import { translationsManager } from '$lib/server/translations-manager.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	return {
		_loadedTranslations: _getTranslations()
	};
};


// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
// DO NOT EDIT MANUALLY - This section will be overwritten on each build
// =============================================================================

// Auto-generated sveltekit-translations-loader translations function
function _getTranslations() {
	const event = getRequestEvent();
	const locale = event?.locals.locale || 'en-US';
	
	const allTranslations = translationsManager.getTranslations(locale);
	
	// Get accumulated translations from parent routes
	const parentTranslations = event?.locals._translationsData || {};
	
	// Auto-injected translation keys based on usage
	const currentTranslations = {
		'layoutTitle': allTranslations['layoutTitle'] || 'layoutTitle (missing)',
		'layoutDescription': allTranslations['layoutDescription'] || 'layoutDescription (missing)',
		'hello': allTranslations['hello'] || 'hello (missing)',
		'hey': allTranslations['hey'] || 'hey (missing)',
		'pageTitle': allTranslations['pageTitle'] || 'pageTitle (missing)',
		'pageContent': allTranslations['pageContent'] || 'pageContent (missing)',
		'nested-params': allTranslations['nested-params'] || 'nested-params (missing)'
	};
	
	// Merge with parent translations and extra keys
	const extraKeys = event?.locals.extraKeys || {};
	const combinedTranslations = { ...parentTranslations, ...currentTranslations, ...extraKeys };
	event.locals._translationsData = combinedTranslations;
	
	return combinedTranslations;
}

// =============================================================================
// END AUTO-GENERATED CODE
// =============================================================================
