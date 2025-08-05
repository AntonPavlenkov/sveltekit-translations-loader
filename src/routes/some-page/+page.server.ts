import type { PageServerLoad } from './$types.js';
// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['zap'];
// END AUTO-GENERATED CODE

export const load: PageServerLoad = async () => {
	return {
		_loadedTranslations: _getTranslations(_translationKeys)
	};
};
