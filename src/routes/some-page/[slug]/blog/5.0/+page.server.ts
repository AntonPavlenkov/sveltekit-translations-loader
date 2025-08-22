// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['welcome', 'hey'];
// END AUTO-GENERATED CODE

export const load = async () => {
	console.time('load');
	console.timeEnd('load');
	return { _loadedTranslations: _getTranslations(_translationKeys) };
};
