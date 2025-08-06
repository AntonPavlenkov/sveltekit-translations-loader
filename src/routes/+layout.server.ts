import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Get user's locale from locals (set by server hook)
	const userLocale = locals.locale;
	const availableLocales = locals.translationsManager.getLocales();

	return {
		locale: userLocale,
		availableLocales
	};
};
