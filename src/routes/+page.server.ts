import type { PageServerLoad } from './$types.js';
import { getRequestEvent } from '$app/server';
import { translationsManager } from '$lib/server/translations-manager.js';

// Custom code - this should be preserved

const customFunction = () => {
	return 'This is custom code that should be preserved';
};

// More custom code
const customVariable = 'custom value';

export const load: PageServerLoad = async () => {
	return {
		_loadedTranslations: _getTranslations(),
		customFunction: customFunction(),
		customVariable
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
		'hello': allTranslations['hello'] || 'hello (missing)',
		'welcome': allTranslations['welcome'] || 'welcome (missing)',
		'user-count': allTranslations['user-count'] || 'user-count (missing)',
		'goodbye': allTranslations['goodbye'] || 'goodbye (missing)',
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
