import { getRequestEvent } from '$app/server';

export function _getTranslations(loadFunctionKeys: string[] = []) {
	const { locals } = getRequestEvent();

	const allTranslations = locals.translationsManager.getTranslations(locals.locale);
	// Get accumulated translations from parent routes
	const parentTranslations = locals._translationsData || {};

	// Auto-injected translation keys based on usage
	const currentTranslations = loadFunctionKeys
		? {
				...loadFunctionKeys.reduce(
					(acc, key) => {
						acc[key] = allTranslations[key] || `(${key} missing)`;
						return acc;
					},
					{} as Record<string, string>
				)
			}
		: {};

	// Merge with parent translations and extra keys
	const extraKeys = locals.extraKeys || {};
	const combinedTranslations = { ...parentTranslations, ...currentTranslations, ...extraKeys };
	locals._translationsData = combinedTranslations;

	return locals._translationsData;
}
