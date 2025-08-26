import { getRequestEvent } from '$app/server';
import RouteKeysMap from './route-keys-map.js';

export function _getTranslations(type: 'page' | 'layout', functionId: string) {
	const { locals, route } = getRequestEvent();
	const routeId = route.id as string;

	const routeKeys = RouteKeysMap.get(`{route:"${routeId}",type:"${type}"}`) || [];
	const isSentAlready = locals.translationsCookies[routeId + '_' + functionId] || false;

	const allTranslations = locals.translationsManager.getTranslations(locals.locale);
	let newTranslationsData = {
		...(locals._translationsData || {}),
		...(locals.extraKeys || {})
	};
	if (isSentAlready) {
		console.log('isSentAlready', routeId, isSentAlready);
		return newTranslationsData;
	} else {
		newTranslationsData = {
			...routeKeys.reduce(
				(acc, key) => ({ ...acc, [key]: allTranslations[key] || `(${key} missing)` }),
				{}
			),
			...newTranslationsData
		};
		locals.translationsManager.setCookiesWithData(routeId, functionId);
	}

	return (locals._translationsData = newTranslationsData);
}
