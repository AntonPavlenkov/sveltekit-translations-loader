import { getRequestEvent } from '$app/server';

export function _getTranslations(loadFunctionKeys: string[] = []) {
	const event = getRequestEvent();

	const allTranslations = event?.locals.translationsManager.getTranslations(event?.locals.locale);
	// Get accumulated translations from parent routes
	const parentTranslations = event?.locals._translationsData || {};

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
	const extraKeys = event?.locals.extraKeys || {};
	const combinedTranslations = { ...parentTranslations, ...currentTranslations, ...extraKeys };
	event.locals._translationsData = combinedTranslations;

	return event.locals._translationsData;
}
