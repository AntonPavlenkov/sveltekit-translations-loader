import type { LayoutServerLoad } from './$types.js';
// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from 'sveltekit-translations-loader/server';
const _translationKeys: string[] = [
	'layoutTitle',
	'layoutDescription',
	'hello',
	'hey',
	'pageTitle',
	'pageContent',
	'nested-params',
	'zap'
];
// END AUTO-GENERATED CODE
// =============================================================================

export const load: LayoutServerLoad = async () => {
	return {
		zoom: 'zoom',
		bro: 'bro',
		_loadedTranslations: _getTranslations(_translationKeys)
	};
};
