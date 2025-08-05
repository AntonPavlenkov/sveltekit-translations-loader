import { getRequestEvent } from '$app/server';

export function _getTranslations(loadFunctionKeys: string[] = []) {
	const { locals } = getRequestEvent();
	const allTranslations = locals.translationsManager.getTranslations(locals.locale);

	return (locals._translationsData = {
		...(locals._translationsData || {}),
		...loadFunctionKeys.reduce(
			(acc, key) => ({ ...acc, [key]: allTranslations[key] || `(${key} missing)` }),
			{}
		),
		...(locals.extraKeys || {})
	});
}
