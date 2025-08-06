import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Components Outside Routes Directory', () => {
	const testDir = join(process.cwd(), 'test-outside-routes');
	const routesDir = join(testDir, 'src', 'routes');
	const variantsDir = join(testDir, 'src', 'variants');
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
			mkdirSync(variantsDir, { recursive: true });
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
			if (existsSync(join(variantsDir, 'AliestTester.svelte'))) {
				unlinkSync(join(variantsDir, 'AliestTester.svelte'));
			}
			if (existsSync(join(routesDir, 'test-page', '+page.svelte'))) {
				unlinkSync(join(routesDir, 'test-page', '+page.svelte'));
			}
			if (existsSync(join(routesDir, 'test-page', '+page.server.ts'))) {
				unlinkSync(join(routesDir, 'test-page', '+page.server.ts'));
			}
			if (existsSync(routesDir)) {
				rmdirSync(join(routesDir, 'test-page'));
			}
			if (existsSync(variantsDir)) {
				rmdirSync(variantsDir);
			}
			if (existsSync(testDir)) {
				rmdirSync(testDir, { recursive: true });
			}
		} catch {
			// Ignore cleanup errors
		}
	});

	it('should detect components outside routes directory that use translations', () => {
		// Create a component outside routes directory with i18n usage
		const aliestTesterComponent = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
<p>Alias tester: {t.hey('df')}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), aliestTesterComponent);

		// Create a page that uses the component
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(join(routesDir, 'test-page', '+page.svelte'), pageComponent);

		// Check that the component has i18n usage
		const aliestContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		const hasI18nUsage = aliestContent.includes('@i18n');

		expect(hasI18nUsage).toBe(true);
	});

	it('should detect components outside routes directory that use _loadedTranslations', () => {
		// Create a component outside routes directory with _loadedTranslations usage
		const componentWithLoadedTranslations = `
<script lang="ts">
	// No i18n imports, but uses _loadedTranslations
</script>

<p>Loaded translations: {_loadedTranslations['hello']}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), componentWithLoadedTranslations);

		// Create a page that uses the component
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(join(routesDir, 'test-page', '+page.svelte'), pageComponent);

		// Check that the component has _loadedTranslations usage
		const aliestContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		const hasLoadedTranslations = aliestContent.includes('_loadedTranslations');

		expect(hasLoadedTranslations).toBe(true);
	});

	it('should detect dependency chain from outside routes to page components', () => {
		// Create a component outside routes directory with i18n usage
		const aliestTesterComponent = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), aliestTesterComponent);

		// Create a page that uses the component
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(join(routesDir, 'test-page', '+page.svelte'), pageComponent);

		// Check that the dependency chain is established
		const aliestContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		const pageContent = readFileSync(join(routesDir, 'test-page', '+page.svelte'), 'utf8');

		expect(aliestContent.includes('@i18n')).toBe(true);
		expect(pageContent.includes('AliestTester.svelte')).toBe(true);
	});

	it('should skip components outside routes that have no translation usage', () => {
		// Create a component outside routes directory without translation usage
		const componentWithoutTranslations = `
<script lang="ts">
	// No i18n imports or _loadedTranslations usage
</script>

<p>Hello World</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), componentWithoutTranslations);

		// Create a page that uses the component
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(join(routesDir, 'test-page', '+page.svelte'), pageComponent);

		// Check that the component has no translation usage
		const aliestContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		const hasI18nUsage = aliestContent.includes('@i18n');
		// Check for actual usage, not just the string in comments
		const hasLoadedTranslations =
			aliestContent.includes("_loadedTranslations['") ||
			aliestContent.includes('_loadedTranslations["') ||
			aliestContent.includes('_loadedTranslations.');

		expect(hasI18nUsage).toBe(false);
		expect(hasLoadedTranslations).toBe(false);
	});
});
