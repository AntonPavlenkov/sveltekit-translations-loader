import { getRequestEvent } from '$app/server';
import type { Cookies } from '@sveltejs/kit';

const cookiesSettings = {
	path: '/', // cookie available across the site
	httpOnly: true, // not accessible via JS
	secure: true, // only sent over HTTPS
	sameSite: 'lax' as const, // CSRF protection
	maxAge: 60 * 15 // 15 minutes in seconds
} as const;

export const getCookiesSettingsForTranslations = (domain: string) => {
	return {
		...cookiesSettings,
		domain
	};
};

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
		const { locals, cookies, url, request } = getRequestEvent();
		const dest = request.headers.get('sec-fetch-dest');
		const mode = request.headers.get('sec-fetch-mode');
		const isDocumentNav = dest === 'document' && mode === 'navigate';

		let currentTabId = cookies.get('_translations_active_tab_id');

		if (isDocumentNav && currentTabId) {
			cookies.delete('_translations_active_tab_id', { path: '/' });
			cookies.delete('_translations_cookies_' + currentTabId, { path: '/' });
		}

		// Only generate new tab ID if none exists
		if (!currentTabId || isDocumentNav) {
			currentTabId = crypto.randomUUID();
			// Set the tab ID cookie for future requests (override httpOnly to false for JS access)
			cookies.set('_translations_active_tab_id', currentTabId, {
				...getCookiesSettingsForTranslations(url.hostname),
				httpOnly: false
			});
		}

		// Get existing translations cookies for this tab
		const translationsCookies = this.getCookiesWithData(currentTabId, cookies);

		locals.translationsCookies = translationsCookies;
		locals.translationsTabId = currentTabId;

		console.log('Tab ID:', currentTabId, 'Route:', url.pathname);
		locals.translationsManager = this as unknown as typeof locals.translationsManager;
	};

	setCookiesWithData = (routeId: string, functionId: string) => {
		const { locals, cookies, url } = getRequestEvent();
		locals.translationsCookies[routeId + '_' + functionId] = true;
		const cookieName = '_translations_cookies_' + locals.translationsTabId;
		const ObjectToAppend = btoa(JSON.stringify(locals.translationsCookies)); //To base64
		cookies.set(cookieName, ObjectToAppend, {
			...getCookiesSettingsForTranslations(url.hostname),
			maxAge: 60 * 15 // 15 minutes
		});
	};

	private getCookiesWithData = (tabId: string | undefined, cookies: Cookies) => {
		if (!tabId) return {};
		const cookieName = '_translations_cookies_' + tabId;
		const cookie = cookies.get(cookieName);
		if (cookie) {
			try {
				const decoded = atob(cookie);
				return JSON.parse(decoded);
			} catch (error) {
				console.warn('Failed to parse translations cookie:', error);
				// Clean up corrupted cookie
				cookies.delete(cookieName, { path: '/' });
				return {};
			}
		}
		return {};
	};

	/**
	 * Validate if a string is a valid UUID
	 */
	private isValidUUID = (str: string): boolean => {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		return uuidRegex.test(str);
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
