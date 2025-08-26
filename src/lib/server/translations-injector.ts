import { getRequestEvent } from '$app/server';
import RouteKeysMap from './route-keys-map.js';

export function _getTranslations(type: 'page' | 'layout') {
	const { locals, route } = getRequestEvent();
	const routeId = route.id;
	const routeKeys = RouteKeysMap.get(`{route:"${routeId}",type:"${type}"}`) || [];
	const allTranslations = locals.translationsManager.getTranslations(locals.locale);

	return (locals._translationsData = {
		...(locals._translationsData || {}),
		...routeKeys.reduce(
			(acc, key) => ({ ...acc, [key]: allTranslations[key] || `(${key} missing)` }),
			{}
		),
		...(locals.extraKeys || {})
	});
}
