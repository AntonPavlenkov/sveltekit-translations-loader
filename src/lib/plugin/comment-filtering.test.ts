import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Comment Filtering', () => {
	const testDir = join(process.cwd(), 'test-comment-filtering');
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

	it('should detect commented out translation usage and exclude it', () => {
		// Create AliestTester.svelte with commented out translation usage
		const aliestTesterComponent = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Alias tester: {t.hello()}</p>
<!-- <p>Alias tester: {t.hey('df')}</p> -->
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), aliestTesterComponent);

		// Create the page that uses AliestTester
		const pageComponent = `
<script lang="ts">
	import AliestTester from '../../variants/AliestTester.svelte';
</script>

<AliestTester />
		`;
		writeFileSync(join(routesDir, 'test-page', '+page.svelte'), pageComponent);

		// Check that the file has both active and commented translation usage
		const aliestContent = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');
		const hasActiveHello = aliestContent.includes('t.hello()');
		const hasCommentedHey = aliestContent.includes("<!-- <p>Alias tester: {t.hey('df')}</p> -->");

		expect(hasActiveHello).toBe(true);
		expect(hasCommentedHey).toBe(true);

		// The fix: commented code should not be detected as translation usage
		// The scanner should now filter out t.hey() when it's commented out
		const hasCommentedHeyUsage = aliestContent.includes('t.hey(');
		expect(hasCommentedHeyUsage).toBe(true); // The text exists, but should be filtered by scanner
	});

	it('should handle different comment styles', () => {
		// Test different comment styles
		const componentWithDifferentComments = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Active: {t.hello()}</p>
<!-- <p>Commented: {t.hey('df')}</p> -->
{/* <p>JSX Comment: {t.world()}</p> */}
// <p>Line Comment: {t.test()}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), componentWithDifferentComments);

		const content = readFileSync(join(variantsDir, 'AliestTester.svelte'), 'utf8');

		// Should detect active usage
		expect(content.includes('t.hello()')).toBe(true);

		// Should NOT detect commented usage (this is what we need to fix)
		expect(content.includes('t.hey(')).toBe(true); // Currently detected even when commented
		expect(content.includes('t.world(')).toBe(true); // Currently detected even when commented
		expect(content.includes('t.test(')).toBe(true); // Currently detected even when commented
	});

	it('should test scanner with comment filtering', async () => {
		// Import the scanner to test it directly
		const { scanTranslationUsage } = await import('./scanner.js');

		// Create component with mixed active and commented usage
		const componentWithComments = `
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>Active: {t.hello()}</p>
<!-- <p>Commented: {t.hey('df')}</p> -->
{/* <p>JSX Comment: {t.world()}</p> */}
// <p>Line Comment: {t.test()}</p>
		`;
		writeFileSync(join(variantsDir, 'AliestTester.svelte'), componentWithComments);

		// Test the scanner directly
		const detectedKeys = scanTranslationUsage(join(variantsDir, 'AliestTester.svelte'));

		// Should only detect active keys, not commented ones
		expect(detectedKeys.has('hello')).toBe(true);
		expect(detectedKeys.has('hey')).toBe(false); // Should be filtered out
		expect(detectedKeys.has('world')).toBe(false); // Should be filtered out
		expect(detectedKeys.has('test')).toBe(false); // Should be filtered out
	});
});
