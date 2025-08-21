import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { sveltekitTranslationsImporterPlugin } from './src/lib/plugin';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/types/default-translations.ts',
			verbose: false, // Set to true to enable console logging
			removeFunctionsOnBuild: true // Remove @i18n imports and use direct page.data access (only during build)
		}),
		sveltekit()
	]
});
