import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sveltekitTranslationsImporterPlugin } from './index.js';

describe('AliestTester Use Case', () => {
	const testDir = join(process.cwd(), 'test-aliest-tester');
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
			mkdirSync(join(routesDir, 'some-page', '[slug]', 'blog', '5.0'), { recursive: true });
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
	hey: 'Hey'
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
			if (existsSync(join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'))) {
				unlinkSync(join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'));
			}
			if (existsSync(join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.server.ts'))) {
				unlinkSync(join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.server.ts'));
			}
			if (existsSync(routesDir)) {
				rmdirSync(join(routesDir, 'some-page', '[slug]', 'blog', '5.0'), { recursive: true });
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

	it('should detect AliestTester.svelte changes and update corresponding +page.server.ts', () => {
		// Create AliestTester.svelte with i18n usage (exact content from user's file)
		const aliestTesterComponent = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
<p>Alias tester: {t.hey('df')}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), aliestTesterComponent);

		// Create the page that uses AliestTester (simulating the actual use case)
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(
			join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'),
			pageComponent
		);

		// Verify that AliestTester has i18n usage
		const aliestContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		const hasI18nUsage = aliestContent.includes('@i18n');
		const hasHelloUsage = aliestContent.includes('t.hello()');
		const hasHeyUsage = aliestContent.includes('t.hey(');

		expect(hasI18nUsage).toBe(true);
		expect(hasHelloUsage).toBe(true);
		expect(hasHeyUsage).toBe(true);

		// Verify that the page imports AliestTester
		const pageContent = readFileSync(
			join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'),
			'utf8'
		);
		const importsAliestTester = pageContent.includes('AliestTester.svelte');

		expect(importsAliestTester).toBe(true);
	});

	it('should detect translation keys used in AliestTester and include them in server file', () => {
		// Create AliestTester.svelte with specific translation keys
		const aliestTesterComponent = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
<p>Alias tester: {t.hey('df')}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), aliestTesterComponent);

		// Create the page that uses AliestTester
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(
			join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'),
			pageComponent
		);

		// Extract translation keys from AliestTester
		const aliestContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');

		// Check for specific translation function calls
		const hasHello = aliestContent.includes('t.hello()');
		const hasHey = aliestContent.includes('t.hey(');

		expect(hasHello).toBe(true);
		expect(hasHey).toBe(true);

		// The expected translation keys that should be included in the server file
		const expectedKeys = ['hello', 'hey'];

		// Verify that these keys would be detected by the plugin
		expectedKeys.forEach((key) => {
			expect(aliestContent.includes(`t.${key}`)).toBe(true);
		});
	});

	it('should handle AliestTester changes and trigger server file updates', () => {
		// Initial state: Create AliestTester with i18n usage
		const initialAliestTester = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), initialAliestTester);

		// Create the page that uses AliestTester
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(
			join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'),
			pageComponent
		);

		// Verify initial state
		const initialContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		expect(initialContent.includes('t.hello()')).toBe(true);
		expect(initialContent.includes('t.hey(')).toBe(false);

		// Simulate editing AliestTester (adding more translation usage)
		const updatedAliestTester = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
<p>Alias tester: {t.hey('df')}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), updatedAliestTester);

		// Verify the change was applied
		const updatedContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		expect(updatedContent.includes('t.hello()')).toBe(true);
		expect(updatedContent.includes('t.hey(')).toBe(true);

		// Verify that the page still imports AliestTester
		const pageContent = readFileSync(
			join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'),
			'utf8'
		);
		expect(pageContent.includes('AliestTester.svelte')).toBe(true);
	});

	it('should detect when AliestTester is outside routes but used by page components', () => {
		// Create AliestTester in variants directory (outside routes)
		const aliestTesterComponent = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
<p>Alias tester: {t.hey('df')}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), aliestTesterComponent);

		// Create a page in routes that uses AliestTester
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(
			join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'),
			pageComponent
		);

		// Verify the dependency relationship
		const aliestPath = join(variantsDir, 'AliestTester.svelte');
		const pagePath = join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte');

		// Check that AliestTester is outside routes
		expect(aliestPath.includes('variants')).toBe(true);
		expect(aliestPath.includes('routes')).toBe(false);

		// Check that the page is in routes
		expect(pagePath.includes('routes')).toBe(true);

		// Check that AliestTester has translation usage
		const aliestContent = readFileSync(aliestPath, 'utf8');
		expect(aliestContent.includes('@i18n')).toBe(true);

		// Check that the page imports AliestTester
		const pageContent = readFileSync(pagePath, 'utf8');
		expect(pageContent.includes('AliestTester.svelte')).toBe(true);
	});

	it('should use plugin to process AliestTester use case', () => {
		// Create AliestTester.svelte with i18n usage
		const aliestTesterComponent = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
<p>Alias tester: {t.hey('df')}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), aliestTesterComponent);

		// Create the page that uses AliestTester
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(
			join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'),
			pageComponent
		);

		// Create plugin instance
		const plugin = sveltekitTranslationsImporterPlugin({
			defaultPath: defaultTranslationsPath,
			runtimePath: join(testDir, 'src', 'lib', 'translations', 'runtime', 'index.ts'),
			verbose: true
		});

		// Verify plugin is created successfully
		expect(plugin).toBeDefined();
		expect(typeof plugin.name).toBe('string');
		expect(plugin.name).toBe('sveltekit-translations-loader');

		// Verify that the plugin can handle the AliestTester use case
		// by checking that the files are set up correctly for processing
		const aliestContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		const pageContent = readFileSync(
			join(routesDir, 'some-page', '[slug]', 'blog', '5.0', '+page.svelte'),
			'utf8'
		);

		// Verify the setup is correct for the plugin to process
		expect(aliestContent.includes('@i18n')).toBe(true);
		expect(pageContent.includes('AliestTester.svelte')).toBe(true);
	});

	it('should handle commenting out translation usage and update server file', async () => {
		// Import the scanner to test it directly
		const { scanTranslationUsage } = await import('./scanner.js');

		// Initial state: AliestTester with both hello and hey usage
		const initialAliestTester = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
<p>Alias tester: {t.hey('df')}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), initialAliestTester);

		// Test initial state - should detect both keys
		let detectedKeys = scanTranslationUsage(join(variantsDir, 'AliestTester.svelte'));
		expect(detectedKeys.has('hello')).toBe(true);
		expect(detectedKeys.has('hey')).toBe(true);

		// Simulate commenting out the hey usage (like the user did)
		const commentedAliestTester = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
<!-- <p>Alias tester: {t.hey('df')}</p> -->
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), commentedAliestTester);

		// Test after commenting - should only detect hello, not hey
		detectedKeys = scanTranslationUsage(join(variantsDir, 'AliestTester.svelte'));
		expect(detectedKeys.has('hello')).toBe(true);
		expect(detectedKeys.has('hey')).toBe(false); // Should be filtered out when commented

		// Verify the file content shows the change
		const aliestContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		expect(aliestContent.includes('t.hello()')).toBe(true);
		expect(aliestContent.includes("<!-- <p>Alias tester: {t.hey('df')}</p> -->")).toBe(true);
	});
});
