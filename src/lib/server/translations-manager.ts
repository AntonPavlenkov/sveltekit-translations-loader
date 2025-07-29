interface TranslationData {
	[key: string]: string;
}

interface LocaleTranslations {
	[locale: string]: TranslationData;
}

class TranslationsManager {
	private translations: LocaleTranslations = {};
	private updateInterval: NodeJS.Timeout | null = null;
	private defaultLocale = 'en-US';

	constructor() {
		console.log('🔧 TranslationsManager constructor called');
		this.startPeriodicUpdates();
	}

	/**
	 * Initialize translations with default data and start periodic updates
	 */
	async initialize(defaultTranslations: TranslationData): Promise<void> {
		console.log('🔧 TranslationsManager initialize called with:', Object.keys(defaultTranslations));

		// Set default translations as fallback
		this.translations[this.defaultLocale] = defaultTranslations;

		// Load translations for all supported locales
		await this.loadAllTranslations();

		console.log('✓ Translations manager initialized');
		console.log('📋 Available locales:', this.getAvailableLocales());
	}

	/**
	 * Get translations for a specific locale
	 */
	getTranslations(locale: string): TranslationData {
		console.log('🔍 Getting translations for locale:', locale);
		const result = this.translations[locale] || this.translations[this.defaultLocale] || {};
		console.log('📝 Returning translations keys:', Object.keys(result));
		return result;
	}

	/**
	 * Get available locales
	 */
	getAvailableLocales(): string[] {
		const locales = Object.keys(this.translations);
		console.log('🌍 Available locales:', locales);
		return locales;
	}

	/**
	 * Add or update translations for a locale
	 */
	setTranslations(locale: string, translations: TranslationData): void {
		this.translations[locale] = { ...this.translations[locale], ...translations };
	}

	/**
	 * Load translations from external source (API, database, etc.)
	 */
	private async loadAllTranslations(): Promise<void> {
		const supportedLocales = ['en-US', 'de-DE', 'es-ES', 'fr-FR'];
		console.log('📥 Loading translations for locales:', supportedLocales);

		for (const locale of supportedLocales) {
			if (locale === this.defaultLocale) continue; // Skip default, already set

			try {
				const translations = await this.fetchTranslationsForLocale(locale);
				this.translations[locale] = translations;
				console.log(`✓ Loaded translations for ${locale}:`, Object.keys(translations));
			} catch (error) {
				console.warn(`⚠ Failed to load translations for ${locale}:`, error);
				// Use default translations as fallback
				this.translations[locale] = this.translations[this.defaultLocale];
			}
		}
	}

	/**
	 * Fetch translations for a specific locale from external source
	 * In production, this would call your translation API/database
	 */
	private async fetchTranslationsForLocale(locale: string): Promise<TranslationData> {
		// Mock implementation - replace with your actual translation source
		const mockTranslations: { [locale: string]: TranslationData } = {
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

	/**
	 * Start periodic updates (every hour)
	 */
	private startPeriodicUpdates(): void {
		// Update every hour (3600000 ms)
		this.updateInterval = setInterval(
			async () => {
				console.log('🔄 Updating translations...');
				await this.loadAllTranslations();
				console.log('✓ Translations updated');
			},
			60 * 60 * 1000
		);
	}

	/**
	 * Stop periodic updates
	 */
	destroy(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}
}

// Singleton instance
export const translationsManager = new TranslationsManager();

export type { LocaleTranslations, TranslationData };
