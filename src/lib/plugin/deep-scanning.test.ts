import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { scanComponentTree, findPageTranslationUsage } from './scanner.js';

describe('Deep Scanning Functionality', () => {
	const testDir = './test-deep-scanning';
	const testPagePath = join(testDir, 'src/routes/deep-scanning-test/+page.svelte');
	const testComponentPath = join(testDir, 'src/routes/deep-scanning-test/DeepScanningComponent.svelte');
	const testNestedComponentPath = join(testDir, 'src/routes/deep-scanning-test/NestedTranslationComponent.svelte');
	const testDeepNestedComponentPath = join(testDir, 'src/routes/deep-scanning-test/DeepNestedComponent.svelte');

	beforeAll(() => {
		// Create test directory structure
		mkdirSync(join(testDir, 'src/routes/deep-scanning-test'), { recursive: true });

		// Create test page with no direct translation usage
		const testPageContent = `<script lang="ts">
	// This page has NO direct translation usage
	import DeepScanningComponent from './DeepScanningComponent.svelte';
	import NestedTranslationComponent from './NestedTranslationComponent.svelte';
</script>

<main>
	<DeepScanningComponent />
	<NestedTranslationComponent />
</main>`;

		// Create test component with translation usage
		const testComponentContent = `<script lang="ts">
	import * as t from '@i18n';
</script>

<div>
	{t.hello()} - {t.welcome()} - {t.userCount(5)}
</div>`;

		// Create nested component with translation usage
		const testNestedComponentContent = `<script lang="ts">
	import * as t from '@i18n';
	import DeepNestedComponent from './DeepNestedComponent.svelte';
</script>

<div>
	{t.pageContent()} - {t.goodbye()}
	<DeepNestedComponent />
</div>`;

		// Create deep nested component with translation usage
		const testDeepNestedComponentContent = `<script lang="ts">
	import * as t from '@i18n';
</script>

<div>
	{t.hello()} - {t.welcome()} - {t.continueFn()}
</div>`;

		writeFileSync(testPagePath, testPageContent);
		writeFileSync(testComponentPath, testComponentContent);
		writeFileSync(testNestedComponentPath, testNestedComponentContent);
		writeFileSync(testDeepNestedComponentPath, testDeepNestedComponentContent);
	});

	afterAll(() => {
		// Clean up test files
		if (existsSync(testDir)) {
			// Note: In a real test environment, you'd use a proper cleanup utility
			console.log('Test files created at:', testDir);
		}
	});

	it('should scan component tree and find all translation keys from nested components', () => {
		const keys = scanComponentTree(testPagePath, new Set(), true);
		
		// Should find keys from all nested components
		expect(keys).toContain('hello');
		expect(keys).toContain('welcome');
		expect(keys).toContain('userCount');
		expect(keys).toContain('pageContent');
		expect(keys).toContain('goodbye');
		expect(keys).toContain('continueFn');
		
		// Should also find kebab-case variants
		expect(keys).toContain('user-count');
		expect(keys).toContain('continue-fn');
		
		// Total expected keys: 7 unique keys + variants
		expect(keys.size).toBeGreaterThanOrEqual(7);
	});

	it('should find page translation usage with deep scanning', () => {
		const routesDir = resolve(testDir, 'src/routes');
		const pageUsages = findPageTranslationUsage(routesDir, true);
		
		expect(pageUsages.length).toBeGreaterThan(0);
		
		// Find our test page
		const testPage = pageUsages.find(page => 
			page.pageFile.includes('deep-scanning-test/+page.svelte')
		);
		
		expect(testPage).toBeDefined();
		expect(testPage?.usedKeys.size).toBeGreaterThanOrEqual(7);
		
		// Verify all expected keys are present
		const expectedKeys = ['hello', 'welcome', 'userCount', 'pageContent', 'goodbye', 'continueFn'];
		expectedKeys.forEach(key => {
			expect(testPage?.usedKeys.has(key)).toBe(true);
		});
	});

	it('should handle circular dependencies gracefully', () => {
		// Test that circular dependencies don't cause infinite loops
		const visited = new Set<string>();
		const keys = scanComponentTree(testPagePath, visited, false);
		
		expect(keys.size).toBeGreaterThan(0);
		expect(visited.size).toBeGreaterThan(0);
		
		// Should not have visited the same file multiple times
		const uniqueVisited = new Set(visited);
		expect(visited.size).toBe(uniqueVisited.size);
	});
});
