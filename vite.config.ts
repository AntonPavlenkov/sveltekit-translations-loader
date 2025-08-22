import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { sveltekitTranslationsImporterPlugin } from './src/lib/plugin';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/types/default-translations.ts',
			verbose: true, // Set to true to enable console logging
			removeFunctionsOnBuild: false, // Temporarily disable to see if this helps
			consoleNinjaProtection: true // Enable Console Ninja protection
		}),
		sveltekit()
	]
});
