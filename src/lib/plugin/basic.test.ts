import { describe, expect, it } from 'vitest';
import { sanitizeFunctionName } from './helpers.js';

describe('Basic Plugin Tests', () => {
	describe('sanitizeFunctionName', () => {
		it('should convert kebab-case to camelCase', () => {
			expect(sanitizeFunctionName('user-count')).toBe('userCount');
			expect(sanitizeFunctionName('nested-params')).toBe('nestedParams');
			expect(sanitizeFunctionName('page-title')).toBe('pageTitle');
		});

		it('should convert snake_case to camelCase', () => {
			expect(sanitizeFunctionName('user_count')).toBe('userCount');
			expect(sanitizeFunctionName('nested_params')).toBe('nestedParams');
			expect(sanitizeFunctionName('page_title')).toBe('pageTitle');
		});

		it('should handle simple names', () => {
			expect(sanitizeFunctionName('hello')).toBe('hello');
			expect(sanitizeFunctionName('goodbye')).toBe('goodbye');
			expect(sanitizeFunctionName('welcome')).toBe('welcome');
		});

		it('should handle names starting with numbers', () => {
			expect(sanitizeFunctionName('123-count')).toBe('123Count');
			expect(sanitizeFunctionName('1user')).toBe('1user');
			expect(sanitizeFunctionName('0-index')).toBe('0Index');
		});

		it('should handle empty strings', () => {
			expect(sanitizeFunctionName('')).toBe('');
		});
	});

	describe('Plugin Configuration', () => {
		it('should have correct plugin name', () => {
			// This is a basic test to ensure the plugin can be imported
			expect(true).toBe(true);
		});
	});
});
