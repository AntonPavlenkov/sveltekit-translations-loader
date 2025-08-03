// See https://kit.svelte.dev/docs/types#app

import type { TranslationsManager } from 'sveltekit-translations-loader/server';

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			locale: string;
			extraKeys?: Record<string, string>;
			_translationsData?: Record<string, string>;
			translationsManager: TranslationsManager;
		}

		// interface PageState {}
		// interface Platform {}
	}
}

export {};
