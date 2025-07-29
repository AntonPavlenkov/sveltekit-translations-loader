import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { sveltekitTranslationsImporterPlugin } from './src/lib/plugin/index.js';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/lib/default-translations.ts',
			runtimePath: 'src/lib/translations/messages/index.ts'
		})
	]
});
