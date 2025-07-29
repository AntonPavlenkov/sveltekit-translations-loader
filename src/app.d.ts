// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			locale: string;
			extraKeys?: Record<string, string>;
			_translationsData?: Record<string, string>;
			transhakeExtraKeys?: Record<string, string>;
		}
		interface PageData {
			_loadedTranslations?: Record<string, string>;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
