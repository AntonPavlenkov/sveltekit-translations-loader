import { TranslationsManager } from 'sveltekit-translations-loader/server';

import type { Handle } from '@sveltejs/kit';

const translationsManager = new TranslationsManager({
	defaultTranslations: import('./types/default-translations'),
	getAvailableLocales: ['en-US', 'de-DE', 'es-ES', 'fr-FR'],
	getTranslationsForLocale
});

export const init = async () => {
	await translationsManager.initialize();
};

export const handle: Handle = async ({ event, resolve }) => {
	translationsManager.useRoute();

	// Set locale from cookie, then headers, then default
	const cookieLocale = event.cookies.get('locale');
	const headerLocale = event.request.headers.get('accept-language')?.split(',')[0];
	const finalLocale = cookieLocale || headerLocale || 'en-US';
	event.locals.locale = finalLocale;

	return resolve(event);
};

async function getTranslationsForLocale(locale: string) {
	// Mock implementation - replace with your actual translation source
	const mockTranslations: { [locale: string]: Record<string, string> } = {
		'de-DE': {
			hello: 'Hallo',
			goodbye: 'Auf Wiedersehen',
			welcome: 'Willkommen, {{name}}!',
			'user-count': 'Es gibt {{count}} Benutzer online',
			'nested-params': 'Hallo {{name}}, du hast {{count}} Nachrichten',
			hey: 'Hallo {{name}}',
			zap: 'Zap',
			layoutTitle: 'Verschachtelter Layout-Titel',
			layoutDescription:
				'Dies ist eine Layout-Beschreibung, die von untergeordneten Routen geerbt wird',
			pageTitle: 'Verschachtelter Seiten-Titel',
			pageContent:
				'Dieser Seiteninhalt demonstriert die Vererbung von Übersetzungen in verschachtelten Routen'
		},
		'es-ES': {
			hello: 'Hola',
			goodbye: 'Adiós',
			welcome: '¡Bienvenido, {{name}}!',
			'user-count': 'Hay {{count}} usuarios en línea',
			'nested-params': 'Hola {{name}}, tienes {{count}} mensajes',
			hey: '¡Hola {{name}}!',
			zap: 'Zap',
			layoutTitle: 'Título de Layout Anidado',
			layoutDescription: 'Esta es una descripción de layout que será heredada por rutas hijas',
			pageTitle: 'Título de Página Anidada',
			pageContent:
				'Este contenido de página demuestra la herencia de traducciones en rutas anidadas'
		},
		'fr-FR': {
			hello: 'Bonjour',
			goodbye: 'Au revoir',
			welcome: 'Bienvenue, {{name}}!',
			'user-count': 'Il y a {{count}} utilisateurs en ligne',
			'nested-params': 'Bonjour {{name}}, vous avez {{count}} messages',
			hey: 'Bonjour {{name}}',
			zap: 'Zap',
			layoutTitle: 'Titre de Layout Imbriqué',
			layoutDescription:
				'Ceci est une description de layout qui sera héritée par les routes enfants',
			pageTitle: 'Titre de Page Imbriquée',
			pageContent:
				"Ce contenu de page démontre l'héritage des traductions dans les routes imbriquées"
		}
	};

	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 100));

	return mockTranslations[locale] || {};
}
