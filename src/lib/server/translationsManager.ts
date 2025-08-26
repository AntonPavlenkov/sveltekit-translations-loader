import { getRequestEvent } from '$app/server';

// Types
interface TranslationData {
	[key: string]: string;
}

interface LocaleTranslations {
	[locale: string]: TranslationData;
}

type DefaultTranslationsInput =
	| TranslationData
	| (() => Promise<TranslationData>)
	| Promise<{ default: TranslationData }>;

type AvailableLocalesInput = (() => Promise<string[]>) | string[];

type TranslationsForLocaleInput = ((locale: string) => Promise<TranslationData>) | TranslationData;

interface TranslationsManagerConfig {
	defaultTranslations: DefaultTranslationsInput;
	getAvailableLocales: AvailableLocalesInput;
	getTranslationsForLocale: TranslationsForLocaleInput;
	useCookie: boolean;
}

// Constants
const DEFAULT_LOCALE = 'en-US';
const MINUTES_TO_MS = 60 * 1000;

// Utility functions
const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
	typeof value === 'function';
const isPromise = (value: unknown): value is Promise<unknown> => value instanceof Promise;
const hasContent = (obj: TranslationData): boolean => Object.keys(obj).length > 0;
const clearIntervalSafely = (interval: NodeJS.Timeout | null): void => {
	if (interval) clearInterval(interval);
};
const minutesToMs = (minutes: number): number => minutes * MINUTES_TO_MS;

/**
 * Resolve default translations from various input types
 */
async function resolveDefaultTranslations(
	input: DefaultTranslationsInput
): Promise<TranslationData> {
	if (isFunction(input)) return await (input as () => Promise<TranslationData>)();
	if (isPromise(input)) return (await input).default;
	return input;
}

/**
 * Resolve available locales from various input types
 */
async function resolveAvailableLocales(input: AvailableLocalesInput): Promise<string[]> {
	return isFunction(input) ? await (input as () => Promise<string[]>)() : input;
}

/**
 * Load translations for a single locale with error handling
 */
async function loadLocaleTranslations(
	locale: string,
	getTranslationsForLocale: TranslationsForLocaleInput,
	defaultTranslations: TranslationData,
	fallbackTranslations: TranslationData
): Promise<TranslationData> {
	try {
		const translations = isFunction(getTranslationsForLocale)
			? await (getTranslationsForLocale as (locale: string) => Promise<TranslationData>)(locale)
			: (getTranslationsForLocale as TranslationData);
		return hasContent(translations) ? translations : defaultTranslations;
	} catch (error) {
		console.warn(`⚠ Failed to load translations for ${locale}:`, error);
		return fallbackTranslations;
	}
}

export class TranslationsManager {
	private isInitialized = false;
	private translations: LocaleTranslations = {};
	private updateInterval: NodeJS.Timeout | null = null;
	private supportedLocales: string[] = [];
	private _defaultTranslations: TranslationData | null = null;
	public useCookie: boolean;

	constructor(private config: TranslationsManagerConfig) {
		this.useCookie = config.useCookie || false;
	}

	/**
	 * Start periodic updates for translations
	 */
	public async startPeriodicUpdates(onceInMinutes: number): Promise<void> {
		this.updateInterval = setInterval(
			async () => await this.loadAllTranslations(),
			minutesToMs(onceInMinutes)
		);
	}

	/**
	 * Get translations for a specific locale with fallback logic
	 */
	getTranslations(locale: string): TranslationData {
		return this.translations[locale] || this.translations[DEFAULT_LOCALE] || {};
	}

	/**
	 * Load translations for all supported locales
	 */
	private async loadAllTranslations(): Promise<void> {
		const fallbackTranslations = this.translations[DEFAULT_LOCALE] || {};

		// Load all translations simultaneously in parallel
		const translationPromises = this.supportedLocales.map(async (locale) => {
			try {
				const translations = await loadLocaleTranslations(
					locale,
					this.config.getTranslationsForLocale,
					this._defaultTranslations || {},
					fallbackTranslations
				);
				return { locale, translations };
			} catch (error) {
				console.error(`Failed to load translations for locale ${locale}:`, error);
				return { locale, translations: {} };
			}
		});

		// Wait for all translations to load
		const results = await Promise.all(translationPromises);

		// Assign all translations at once
		for (const { locale, translations } of results) {
			this.translations[locale] = translations;
		}
	}

	/**
	 * Initialize the translations manager
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) return;
		this.isInitialized = true;

		// Resolve available locales and default translations
		this.supportedLocales = await resolveAvailableLocales(this.config.getAvailableLocales);
		this._defaultTranslations = await resolveDefaultTranslations(this.config.defaultTranslations);

		// Set default locale translations and load all translations
		this.translations[DEFAULT_LOCALE] = this._defaultTranslations;
		await this.loadAllTranslations();
	}

	/**
	 * Get all supported locales
	 */
	getLocales(): string[] {
		return this.supportedLocales;
	}

	useRoute = () => {
		const { locals } = getRequestEvent();
		locals.translationsManager = this as unknown as typeof locals.translationsManager;
	};

	/**
	 * Clean up resources
	 */
	destroy(): void {
		clearIntervalSafely(this.updateInterval);
		this.translations = {};
		this.updateInterval = null;
		this.supportedLocales = [];
	}
}

export type { LocaleTranslations, TranslationData };
