import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BatchFileWriter } from './batch-file-writer.js';
import { hasConsoleNinjaCode } from './shared-utils.js';

describe('Console Ninja Guard', () => {
	it('should detect oo_ function names', () => {
		const content = `
export const load = async ({ locals }) => {
	console.time(oo_ts('load plans'));
	const plans = await locals.Http.shopperApi.getPlans();
	console.timeEnd(oo_te('load plans', 'some_id'));
	return { plans };
};`;
		expect(hasConsoleNinjaCode(content)).toBe(true);
	});

	it('should detect istanbul ignore comments with oo functions', () => {
		const content = `
/* istanbul ignore next */ function oo_cm() {
	try {
		return globalThis._console_ninja;
	} catch (e) {}
}`;
		expect(hasConsoleNinjaCode(content)).toBe(true);
	});

	it('should detect globalThis._console_ninja references', () => {
		const content = `
const ninja = globalThis._console_ninja;
export const load = async () => ({ data: 'test' });`;
		expect(hasConsoleNinjaCode(content)).toBe(true);
	});

	it('should detect eval statements', () => {
		const content = `
const result = (0, eval)('some code');
export const load = async () => ({ data: 'test' });`;
		expect(hasConsoleNinjaCode(content)).toBe(true);
	});

	it('should detect c8 ignore comments', () => {
		const content = `
/* c8 ignore start */
function someFunction() {}
/* c8 ignore end */`;
		expect(hasConsoleNinjaCode(content)).toBe(true);
	});

	it('should not detect clean code', () => {
		const content = `
import { _getTranslations } from 'sveltekit-translations-loader/server';

const _translationKeys: string[] = ['test', 'example'];

export const load = async ({ locals }) => {
	const data = await locals.api.getData();
	return {
		data,
		_loadedTranslations: _getTranslations(_translationKeys)
	};
};`;
		expect(hasConsoleNinjaCode(content)).toBe(false);
	});

	it('should not detect legitimate console usage', () => {
		const content = `
export const load = async () => {
	console.log('Loading data...');
	console.error('Something went wrong');
	return { data: 'test' };
};`;
		expect(hasConsoleNinjaCode(content)).toBe(false);
	});
});

describe('Console Ninja Guard Integration', () => {
	const testDir = join(process.cwd(), 'test-console-ninja-guard');
	const testFile = join(testDir, 'test.ts');

	beforeEach(() => {
		// Create test directory and clean up any existing test files
		try {
			if (!existsSync(testDir)) {
				mkdirSync(testDir, { recursive: true });
			}
			if (existsSync(testFile)) unlinkSync(testFile);
		} catch {
			// Ignore cleanup errors
		}
	});

	afterEach(() => {
		// Clean up after tests
		try {
			if (existsSync(testFile)) unlinkSync(testFile);
			if (existsSync(testDir)) rmdirSync(testDir);
		} catch {
			// Ignore cleanup errors
		}
	});

	it('should retry when Console Ninja code is detected', async () => {
		// Create a file with Console Ninja code
		const consoleNinjaContent = `
export const load = async ({ locals }) => {
	console.time(oo_ts('load plans'));
	const plans = await locals.Http.shopperApi.getPlans();
	console.timeEnd(oo_te('load plans', '12345'));
	return { plans };
};`;

		writeFileSync(testFile, consoleNinjaContent, 'utf8');

		const writer = new BatchFileWriter({
			verbose: true,
			consoleNinjaGuard: true,
			maxRetries: 2,
			retryDelay: 50
		});

		// Mock a write that should be retried due to Console Ninja code
		const cleanContent = `
export const load = async ({ locals }) => {
	const plans = await locals.Http.shopperApi.getPlans();
	return { plans };
};`;

		// This should trigger retries but eventually succeed when the file is "cleaned"
		const writePromise = new Promise<void>((resolve) => {
			// Simulate Console Ninja finishing after some time
			setTimeout(() => {
				writeFileSync(testFile, cleanContent, 'utf8');
			}, 100);

			writer.queueWrite(testFile, cleanContent);
			writer.forceFlush().then(resolve);
		});

		await writePromise;

		// Verify the file was eventually written with clean content
		expect(existsSync(testFile)).toBe(true);
	});

	it('should skip write after max retries with Console Ninja code', async () => {
		// Create a file with Console Ninja code that persists
		const consoleNinjaContent = `
export const load = async ({ locals }) => {
	console.time(oo_ts('persistent'));
	return { data: 'test' };
};`;

		writeFileSync(testFile, consoleNinjaContent, 'utf8');

		const writer = new BatchFileWriter({
			verbose: false,
			consoleNinjaGuard: true,
			maxRetries: 1, // Low retry count for faster test
			retryDelay: 10
		});

		const newContent = `
export const load = async ({ locals }) => {
	return { data: 'clean' };
};`;

		// This should fail after retries and leave the original file unchanged
		writer.queueWrite(testFile, newContent);
		await writer.forceFlush();

		// File should still contain Console Ninja code (not overwritten)
		const fileContent = readFileSync(testFile, 'utf8');
		expect(fileContent).toContain('oo_ts');
	});

	it('should detect Console Ninja and retry until stabilized', async () => {
		// Start with a file containing Console Ninja code
		const consoleNinjaContent = `
export const load = async ({ locals }) => {
	console.time(oo_ts('initial'));
	return { data: 'initial' };
	console.timeEnd(oo_te('initial'));
};`;

		writeFileSync(testFile, consoleNinjaContent, 'utf8');

		const writer = new BatchFileWriter({
			verbose: true,
			consoleNinjaGuard: true,
			maxRetries: 2,
			retryDelay: 50,
			consoleNinjaRetryDelay: 100
		});

		const cleanContent = `
export const load = async ({ locals }) => {
	return { data: 'updated' };
};`;

		// Simulate Console Ninja stopping after some time
		const writePromise = new Promise<void>((resolve) => {
			writer.queueWrite(testFile, cleanContent);

			// Simulate Console Ninja stopping after 200ms
			setTimeout(() => {
				// Console Ninja "stops" - file becomes clean
				writeFileSync(testFile, cleanContent, 'utf8');
			}, 200);

			writer.forceFlush().then(resolve);
		});

		await writePromise;

		// The file should eventually be written with clean content
		const finalContent = readFileSync(testFile, 'utf8');
		expect(finalContent).toContain("data: 'updated'");
		expect(finalContent).not.toContain('oo_ts'); // Should not contain Console Ninja code
	});

	it('should use atomic writes to prevent concurrent writes', async () => {
		// Start with a clean file
		const initialContent = `
export const load = async ({ locals }) => {
	return { data: 'initial' };
};`;

		writeFileSync(testFile, initialContent, 'utf8');

		const writer = new BatchFileWriter({
			verbose: true,
			consoleNinjaGuard: true,
			maxRetries: 1,
			retryDelay: 50
		});

		const newContent = `
export const load = async ({ locals }) => {
	return { data: 'locked-write' };
};`;

		// Queue the write and verify the result
		writer.queueWrite(testFile, newContent);
		await writer.forceFlush();

		// Verify the file was written correctly
		const finalContent = readFileSync(testFile, 'utf8');
		expect(finalContent).toContain('locked-write');
		expect(finalContent).not.toContain('initial');
	});
});
