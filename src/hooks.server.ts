import { translationsManager } from '$lib/server/translations-manager.js';
import type { Handle } from '@sveltejs/kit';

let isInitialized = false;

async function ensureInitialized() {
	if (!isInitialized) {
		try {
			const defaultTranslations = (await import('$lib/default-translations.js')).default;
			await translationsManager.initialize(defaultTranslations);
			isInitialized = true;
		} catch (error) {
			console.error('❌ Failed to initialize translations manager:', error);
		}
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	await ensureInitialized();

	// Set locale from cookie, then headers, then default
	const cookieLocale = event.cookies.get('locale');
	const headerLocale = event.request.headers.get('accept-language')?.split(',')[0];
	const finalLocale = cookieLocale || headerLocale || 'en-US';
	event.locals.locale = finalLocale;

	console.log('🌍 Setting locale:', { cookieLocale, headerLocale, finalLocale });

	// Initialize _translationsData with all available translations for the current locale
	// This will be accumulated by each route's load function
	const allTranslations = translationsManager.getTranslations(finalLocale);
	event.locals._translationsData = allTranslations;

	// Example: Add extra translation keys for dynamic content
	// This could be based on user permissions, dynamic data, etc.
	event.locals.transhakeExtraKeys = {
		'dynamic-welcome': `Welcome to ${event.url.pathname}`,
		'user-specific': 'Custom user message',
		// You can add any dynamic keys here that weren't auto-detected
		'api-generated-key': 'Value from API or database'
	};

	return resolve(event);
};
