import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { sveltekitTranslationsImporterPlugin } from './src/lib/plugin';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/types/default-translations.ts',
			runtimePath: 'src/types/translations/messages/index.ts',
			verbose: true // Set to true to enable console logging
		})
	]
});
