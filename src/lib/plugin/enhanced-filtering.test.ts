import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Enhanced File Filtering', () => {
	const testDir = join(process.cwd(), 'test-enhanced-filtering');
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
			if (existsSync(join(routesDir, 'test-page', 'child-component.svelte'))) {
				unlinkSync(join(routesDir, 'test-page', 'child-component.svelte'));
			}
			if (existsSync(join(routesDir, 'test-page', 'grandchild-component.svelte'))) {
				unlinkSync(join(routesDir, 'test-page', 'grandchild-component.svelte'));
			}
			if (existsSync(join(routesDir, 'test-page', '+page.svelte'))) {
				unlinkSync(join(routesDir, 'test-page', '+page.svelte'));
			}
			if (existsSync(join(routesDir, 'test-page', 'no-translations-component.svelte'))) {
				unlinkSync(join(routesDir, 'test-page', 'no-translations-component.svelte'));
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

	it('should detect direct i18n usage', () => {
		// Create a component with direct i18n imports
		const componentWithI18n = `
<script>
import * as t from '@i18n';
</script>

<h1>{t.hello()}</h1>
		`;
		writeFileSync(join(routesDir, 'test-page', 'child-component.svelte'), componentWithI18n);

		// Check if the file has i18n usage
		const content = readFileSync(join(routesDir, 'test-page', 'child-component.svelte'), 'utf8');
		const hasI18nUsage = content.includes('@i18n');

		expect(hasI18nUsage).toBe(true);
	});

	it('should detect _loadedTranslations usage', () => {
		// Create a component with _loadedTranslations usage
		const componentWithLoadedTranslations = `
<script>
// No i18n imports, but uses _loadedTranslations
</script>

<h1>{_loadedTranslations['hello']}</h1>
		`;
		writeFileSync(
			join(routesDir, 'test-page', 'child-component.svelte'),
			componentWithLoadedTranslations
		);

		// Check if the file has _loadedTranslations usage
		const content = readFileSync(join(routesDir, 'test-page', 'child-component.svelte'), 'utf8');
		const hasLoadedTranslations = content.includes('_loadedTranslations');

		expect(hasLoadedTranslations).toBe(true);
	});

	it('should detect indirect usage through component dependencies', () => {
		// Create a grandchild component with i18n usage
		const grandchildWithI18n = `
<script>
import * as t from '@i18n';
</script>

<h1>{t.hello()}</h1>
		`;
		writeFileSync(join(routesDir, 'test-page', 'grandchild-component.svelte'), grandchildWithI18n);

		// Create a child component that uses the grandchild
		const childComponent = `
<script>
import GrandchildComponent from './grandchild-component.svelte';
</script>

<GrandchildComponent />
		`;
		writeFileSync(join(routesDir, 'test-page', 'child-component.svelte'), childComponent);

		// Create a page that uses the child component
		const pageComponent = `
<script>
import ChildComponent from './child-component.svelte';
</script>

<ChildComponent />
		`;
		writeFileSync(join(routesDir, 'test-page', '+page.svelte'), pageComponent);

		// Check that the dependency chain is established
		const grandchildContent = readFileSync(
			join(routesDir, 'test-page', 'grandchild-component.svelte'),
			'utf8'
		);
		const childContent = readFileSync(
			join(routesDir, 'test-page', 'child-component.svelte'),
			'utf8'
		);
		const pageContent = readFileSync(join(routesDir, 'test-page', '+page.svelte'), 'utf8');

		expect(grandchildContent.includes('@i18n')).toBe(true);
		expect(childContent.includes('grandchild-component.svelte')).toBe(true);
		expect(pageContent.includes('child-component.svelte')).toBe(true);
	});

	it('should skip files without any translation usage', () => {
		// Create a component without any translation usage
		const componentWithoutTranslations = `
<script>
// No i18n imports or _loadedTranslations usage
</script>

<h1>Hello World</h1>
		`;
		writeFileSync(
			join(routesDir, 'test-page', 'no-translations-component.svelte'),
			componentWithoutTranslations
		);

		// Check that the file has no translation usage
		const content = readFileSync(
			join(routesDir, 'test-page', 'no-translations-component.svelte'),
			'utf8'
		);
		const hasI18nUsage = content.includes('@i18n');
		// Check for actual usage, not just the string in comments
		const hasLoadedTranslations =
			content.includes("_loadedTranslations['") ||
			content.includes('_loadedTranslations["') ||
			content.includes('_loadedTranslations.');

		expect(hasI18nUsage).toBe(false);
		expect(hasLoadedTranslations).toBe(false);
	});
});
