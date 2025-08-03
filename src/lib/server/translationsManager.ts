interface TranslationData {
	[key: string]: string;
}

interface LocaleTranslations {
	[locale: string]: TranslationData;
}

export class TranslationsManager {
	private isInitialized = false;
	private translations: LocaleTranslations = {};
	private updateInterval: NodeJS.Timeout | null = null;
	private defaultLocale = 'en-US';
	private supportedLocales: string[] = [];
	private _defaultTranslations: TranslationData | null = null;

	constructor(
		private defaultTranslations:
			| TranslationData
			| (() => Promise<TranslationData>)
			| Promise<{ default: TranslationData }>,
		private getAvailableLocales: (() => Promise<string[]>) | string[],
		private getTranslationsForLocale:
			| ((locale: string) => Promise<TranslationData>)
			| TranslationData
	) {}

	private async startPeriodicUpdates(onceInMinutes: number): Promise<void> {
		this.updateInterval = setInterval(
			async () => {
				await this.loadAllTranslations();
			},
			onceInMinutes * 60 * 1000
		);
	}

	getTranslations(locale: string): TranslationData {
		console.log(
			'🚀 ~ TranslationsManager ~ getTranslations ~ this.translations:',
			this.translations,
			locale
		);
		return this.translations[locale] || this.translations[this.defaultLocale] || {};
	}

	private async loadAllTranslations(): Promise<void> {
		for (const locale of this.supportedLocales) {
			try {
				const translations =
					typeof this.getTranslationsForLocale === 'function'
						? await this.getTranslationsForLocale(locale)
						: this.getTranslationsForLocale;
				if (Object.keys(translations).length > 0) {
					this.translations[locale] = translations;
				} else {
					this.translations[locale] = this._defaultTranslations || {};
				}
			} catch (error) {
				console.warn(`⚠ Failed to load translations for ${locale}:`, error);
				this.translations[locale] = this.translations[this.defaultLocale];
			}
		}
		console.log('Finished loading translations');
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) return;
		this.isInitialized = true;

		this.supportedLocales =
			typeof this.getAvailableLocales === 'function'
				? await this.getAvailableLocales()
				: this.getAvailableLocales;
		console.log(
			'🚀 ~ TranslationsManager ~ initialize ~ this.supportedLocales:',
			this.supportedLocales
		);

		if (typeof this.defaultTranslations === 'function') {
			this._defaultTranslations = await this.defaultTranslations();
		} else if (this.defaultTranslations instanceof Promise) {
			const module = await this.defaultTranslations;
			this._defaultTranslations = module.default;
		} else {
			this._defaultTranslations = this.defaultTranslations;
		}

		this.translations[this.defaultLocale] = this._defaultTranslations;

		// Load translations for all supported locales
		await this.loadAllTranslations();
	}

	getLocales(): string[] {
		return this.supportedLocales;
	}

	destroy(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
		}
		this.translations = {};
		this.updateInterval = null;
		this.supportedLocales = [];
	}
}

export type { LocaleTranslations, TranslationData };
