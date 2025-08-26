// Shared page data access

import { page } from '$app/state';

// Shared parameter replacement function
export const r = (str: string, params?: Record<string, string | number>): string => {
	if (!str) return '';
	if (!params) return str;
	let result = str;
	for (const [k, v] of Object.entries(params)) {
		result = result.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v));
	}
	return result;
};

let cachedTranslations: Record<string, string> = {};

export const getTData = () => {
	cachedTranslations = { ...cachedTranslations, ...(page.data._loadedTranslations || {}) };
	return cachedTranslations;
};

export const getValueFromData = (key: string) => {
	return getTData()[key] || '';
};

export const setClientCookieTabId = () => {
	const cookieName = '_translations_active_tab_id';
	const tabId = page.data.translationsTabId;
	if (tabId) {
		document.cookie = `${cookieName}=${tabId}; path=/; max-age=${60 * 15}`; // 15 minutes
	}
};
