import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	getProjectRoot,
	isInsideProjectRoot,
	resolveFromRoot,
	setProjectRoot
} from './project-root.js';
import { parseImports, scanComponentTree } from './scanner.js';

/**
 * These tests guard the monorepo boundary: once the plugin is anchored to a
 * project root it must never scan, read, or follow imports into sibling packages.
 */
describe('Project root boundary (monorepo safety)', () => {
	const testRoot = join(process.cwd(), 'test-project-root');
	const appRoot = join(testRoot, 'packages', 'app');
	const appPage = join(appRoot, 'src', 'routes', '+page.svelte');
	const sharedComponent = join(testRoot, 'packages', 'shared', 'src', 'Secret.svelte');

	beforeEach(() => {
		mkdirSync(join(appRoot, 'src', 'routes'), { recursive: true });
		mkdirSync(join(testRoot, 'packages', 'shared', 'src'), { recursive: true });

		// App page uses `hello` and imports a component from a SIBLING package.
		writeFileSync(
			appPage,
			`<script>
	import Secret from '../../../shared/src/Secret.svelte';
</script>
<p>{t.hello()}</p>
<Secret />`
		);

		// Sibling package component uses `secret` — must never be scanned.
		writeFileSync(
			sharedComponent,
			`<script></script>
<p>{t.secret()}</p>`
		);
	});

	afterEach(() => {
		// Always restore the default root so other test files are unaffected.
		setProjectRoot(process.cwd());
		try {
			rmSync(testRoot, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it('treats only paths inside the anchored root as in-bounds', () => {
		setProjectRoot(appRoot);

		expect(getProjectRoot()).toBe(appRoot);
		expect(isInsideProjectRoot(appPage)).toBe(true);
		expect(isInsideProjectRoot(sharedComponent)).toBe(false);
	});

	it('resolves project-relative paths against the anchored root', () => {
		setProjectRoot(appRoot);

		expect(resolveFromRoot('src/routes/+page.svelte')).toBe(appPage);
	});

	it('does not follow imports into sibling packages', () => {
		setProjectRoot(appRoot);

		const keys = scanComponentTree(appPage, new Set(), false);

		expect(keys.has('hello')).toBe(true);
		expect(keys.has('secret')).toBe(false);
	});

	it('refuses to parse imports for files outside the root', () => {
		setProjectRoot(appRoot);

		// The sibling component itself is out of bounds: parsing returns nothing.
		expect(parseImports(sharedComponent)).toEqual([]);
	});
});
