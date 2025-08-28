#!/usr/bin/env node

import { build } from 'esbuild';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildCLI() {
	try {
		await build({
			entryPoints: [resolve(__dirname, 'src/cli.ts')],
			bundle: true,
			platform: 'node',
			target: 'node18',
			format: 'esm',
			outfile: resolve(__dirname, 'dist/cli.js'),
			external: [
				// Node.js built-ins
				'fs',
				'path',
				'url',
				'process',
				'util',
				'os',
				'child_process',
				// External dependencies that should not be bundled
				'@sveltejs/kit',
				'svelte',
				'vite',
				'typescript',
				'vite-plugin-svelte',
				'@sveltejs/vite-plugin-svelte'
			],
			sourcemap: true,
			minify: false
		});

		console.log('✅ CLI built successfully');
	} catch (error) {
		console.error('❌ CLI build failed:', error);
		process.exit(1);
	}
}

buildCLI();
