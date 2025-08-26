import type { PageServerLoad } from './$types';

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _fileType = 'page';
const _functionId = 'o1n45y35msc';
// END AUTO-GENERATED CODE

export const load: PageServerLoad = async () => {
	// This file will be automatically enhanced by the plugin
	// with translation keys from all nested components
	return {
		// The plugin will inject translation keys here,
		_loadedTranslations: _getTranslations(_fileType, _functionId)
	};
};
