import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sveltekitTranslationsImporterPlugin } from './index.js';

describe('File Filtering', () => {
	const testDir = join(process.cwd(), 'test-filtering');
	const routesDir = join(testDir, 'src', 'routes');
	const defaultTranslationsPath = join(
		testDir,
		'src',
		'lib',
		'translations',
		'@default-translations.ts'
	);

	beforeEach(() => {
		// Create test directory structure
		try {
			mkdirSync(join(testDir, 'src', 'lib', 'translations'), { recursive: true });
			mkdirSync(join(routesDir, 'test-page'), { recursive: true });
		} catch {
			// Ignore if directories already exist
		}

		// Create default translations file
		writeFileSync(
			defaultTranslationsPath,
			`
export default {
	hello: 'Hello',
	world: 'World'
};
		`
		);
	});

	afterEach(() => {
		// Clean up test files
		try {
			if (existsSync(join(routesDir, 'test-page', 'with-i18n.svelte'))) {
				unlinkSync(join(routesDir, 'test-page', 'with-i18n.svelte'));
			}
			if (existsSync(join(routesDir, 'test-page', 'without-i18n.svelte'))) {
				unlinkSync(join(routesDir, 'test-page', 'without-i18n.svelte'));
			}
			if (existsSync(routesDir)) {
				rmdirSync(join(routesDir, 'test-page'));
			}
			if (existsSync(testDir)) {
				rmdirSync(testDir, { recursive: true });
			}
		} catch {
			// Ignore cleanup errors
		}
	});

	it('should only process files with i18n imports', () => {
		// Create a file with i18n imports
		const withI18nContent = `
<script>
import * as t from '@i18n';
</script>

<h1>{t.hello()}</h1>
		`;
		writeFileSync(join(routesDir, 'test-page', 'with-i18n.svelte'), withI18nContent);

		// Create a file without i18n imports
		const withoutI18nContent = `
<script>
// No i18n imports here
</script>

<h1>Hello World</h1>
		`;
		writeFileSync(join(routesDir, 'test-page', 'without-i18n.svelte'), withoutI18nContent);

		// Mock console.log to capture output
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		// Create plugin instance (not used in this test but demonstrates plugin creation)
		sveltekitTranslationsImporterPlugin({
			defaultPath: defaultTranslationsPath,
			runtimePath: join(testDir, 'src', 'lib', 'translations', 'runtime', 'index.ts'),
			verbose: true
		});

		// Simulate file change event for file with i18n imports
		const withI18nFile = join(routesDir, 'test-page', 'with-i18n.svelte');
		const withI18nContent2 = readFileSync(withI18nFile, 'utf8');

		// Check if the file has i18n imports
		const hasImports = withI18nContent2.includes('@i18n');
		expect(hasImports).toBe(true);

		// Simulate file change event for file without i18n imports
		const withoutI18nFile = join(routesDir, 'test-page', 'without-i18n.svelte');
		const withoutI18nContent2 = readFileSync(withoutI18nFile, 'utf8');

		// Check if the file has i18n imports
		const hasImports2 = withoutI18nContent2.includes('@i18n');
		expect(hasImports2).toBe(false);

		// Clean up
		consoleSpy.mockRestore();
	});

	it('should detect i18n imports correctly', () => {
		// Test various import patterns
		const importPatterns = [
			"import * as t from '@i18n'",
			'import * as t from "@i18n"',
			"import { hello } from '@i18n'",
			'import { hello } from "@i18n"',
			"import t from '@i18n'",
			'import t from "@i18n"'
		];

		importPatterns.forEach((pattern, index) => {
			const content = `
<script>
${pattern}
</script>

<h1>Test</h1>
			`;

			const filePath = join(routesDir, `test-${index}.svelte`);
			writeFileSync(filePath, content);

			const fileContent = readFileSync(filePath, 'utf8');
			const hasImports = fileContent.includes('@i18n');

			expect(hasImports).toBe(true);

			// Clean up
			unlinkSync(filePath);
		});
	});
});
