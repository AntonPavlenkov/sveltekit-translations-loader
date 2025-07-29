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

export const getTData = () => {
	return page.data._loadedTranslations || {};
};
