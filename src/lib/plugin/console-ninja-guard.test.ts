import { describe, it, expect } from 'vitest';
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
