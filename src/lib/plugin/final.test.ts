import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedConfig } from 'vitest/node';
import { sanitizeFunctionName } from './helpers.js';
import { sveltekitTranslationsImporterPlugin } from './index.js';

describe('SvelteKit Translations Loader Plugin - Final Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Core Helper Functions', () => {
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

			it('should handle JavaScript reserved words', () => {
				// JavaScript keywords
				expect(sanitizeFunctionName('continue')).toBe('continueFn');
				expect(sanitizeFunctionName('function')).toBe('functionFn');
				expect(sanitizeFunctionName('class')).toBe('classFn');
				expect(sanitizeFunctionName('return')).toBe('returnFn');
				expect(sanitizeFunctionName('break')).toBe('breakFn');

				// Future reserved words
				expect(sanitizeFunctionName('enum')).toBe('enumFn');
				expect(sanitizeFunctionName('interface')).toBe('interfaceFn');

				// Global objects
				expect(sanitizeFunctionName('Array')).toBe('ArrayFn');
				expect(sanitizeFunctionName('console')).toBe('consoleFn');
				expect(sanitizeFunctionName('window')).toBe('windowFn');

				// Common method names
				expect(sanitizeFunctionName('toString')).toBe('toStringFn');
				expect(sanitizeFunctionName('constructor')).toBe('constructorFn');
			});

			it('should handle kebab-case reserved words', () => {
				expect(sanitizeFunctionName('user-function')).toBe('userFunction');
				expect(sanitizeFunctionName('is-array')).toBe('isArray');
				expect(sanitizeFunctionName('get-console')).toBe('getConsole');
			});
		});
	});

	describe('Plugin Configuration', () => {
		it('should create plugin with correct name', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'src/types/default-translations.ts',
				runtimePath: 'src/types/translations/messages/index.ts'
			});

			expect(plugin.name).toBe('sveltekit-translations-loader');
		});

		it('should handle default configuration values', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime'
			});

			expect(plugin.name).toBe('sveltekit-translations-loader');
		});

		it('should have all required plugin hooks', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime'
			});

			expect(plugin.name).toBeDefined();
			expect(plugin.resolveId).toBeDefined();
			expect(plugin.load).toBeDefined();
			expect(plugin.configResolved).toBeDefined();
			expect(plugin.configureServer).toBeDefined();
		});
	});

	describe('Virtual Module System', () => {
		it('should resolve @i18n to virtual module', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime'
			});
			// @ts-expect-error - resolveId is not a function
			const result = plugin.resolveId?.('@i18n');
			expect(result).toBe('\0@i18n');
		});

		it('should return null for other IDs', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime'
			});
			// @ts-expect-error - resolveId is not a function
			const result = plugin.resolveId?.('some-other-id');
			expect(result).toBeNull();
		});

		it('should load virtual module content', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime'
			});
			// @ts-expect-error - load is not a function
			const result = plugin.load?.('\0@i18n');
			expect(result).toContain('Virtual module for @i18n');
			expect(result).toContain('export * from');
		});

		it('should return null for other IDs in load', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime'
			});
			// @ts-expect-error - load is not a function
			const result = plugin.load?.('some-other-id');
			expect(result).toBeNull();
		});
	});

	describe('Build Mode Detection', () => {
		it('should detect production build mode correctly', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime',
				verbose: true
			});

			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			// @ts-expect-error - configResolved is not a function
			plugin.configResolved?.({
				command: 'build',
				mode: 'production'
			} as unknown as ResolvedConfig);

			expect(consoleSpy).toHaveBeenCalledWith(
				'🔍 Mode detected: build (mode: production, isBuildMode: true)'
			);
		});

		it('should detect development build mode correctly', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime',
				verbose: true
			});

			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			// @ts-expect-error - configResolved is not a function
			plugin.configResolved?.({
				command: 'build',
				mode: 'development'
			} as unknown as ResolvedConfig);

			expect(consoleSpy).toHaveBeenCalledWith(
				'🔍 Mode detected: build (mode: development, isBuildMode: false)'
			);
		});

		it('should detect serve mode correctly', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime',
				verbose: true
			});

			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			// @ts-expect-error - configResolved is not a function
			plugin.configResolved?.({
				command: 'serve',
				mode: 'development'
			} as unknown as ResolvedConfig);

			expect(consoleSpy).toHaveBeenCalledWith(
				'🔍 Mode detected: serve (mode: development, isBuildMode: false)'
			);
		});

		it('should not log when verbose is false', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime',
				verbose: false
			});

			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			// @ts-expect-error - configResolved is not a function
			plugin.configResolved?.({ command: 'build', mode: 'production' } as ResolvedConfig);

			expect(consoleSpy).not.toHaveBeenCalled();
		});
	});

	describe('Plugin Features', () => {
		it('should support removeFunctionsOnBuild option', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime',
				removeFunctionsOnBuild: true
			});

			expect(plugin.name).toBe('sveltekit-translations-loader');
		});

		it('should support verbose option', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime',
				verbose: true
			});

			expect(plugin.name).toBe('sveltekit-translations-loader');
		});

		it('should handle all configuration options', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime',
				verbose: true,
				removeFunctionsOnBuild: true
			});

			expect(plugin.name).toBe('sveltekit-translations-loader');
		});
	});

	describe('Plugin Integration', () => {
		it('should be compatible with Vite plugin system', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime'
			});

			// Check that the plugin has the required Vite plugin structure
			expect(typeof plugin.name).toBe('string');
			expect(typeof plugin.resolveId).toBe('function');
			expect(typeof plugin.load).toBe('function');
		});

		it('should support SvelteKit development workflow', () => {
			const plugin = sveltekitTranslationsImporterPlugin({
				defaultPath: 'test/path',
				runtimePath: 'test/runtime'
			});

			// Check that the plugin supports SvelteKit-specific hooks
			expect(typeof plugin.configureServer).toBe('function');
			expect(typeof plugin.configResolved).toBe('function');
		});
	});
});
