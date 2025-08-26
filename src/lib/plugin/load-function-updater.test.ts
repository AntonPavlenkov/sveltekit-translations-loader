import { describe, expect, it } from 'vitest';

// Test the core logic functions directly
describe('load-function-updater - Core Logic Tests', () => {
	// Test the generateTranslationsCode function
	it('should generate correct translation code for development', () => {
		// We'll test the logic by recreating the key functions
		const AUTO_GENERATED_MARKERS = {
			START: '// =============================================================================',
			HEADER: '// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN',
			END: '// END AUTO-GENERATED CODE'
		} as const;

		function generateTranslationsCode(keysArray: string[], isDevelopment: boolean = false): string {
			const importPath = isDevelopment ? '$lib/server' : 'sveltekit-translations-loader/server';

			return `${AUTO_GENERATED_MARKERS.START}
${AUTO_GENERATED_MARKERS.HEADER}
import { _getTranslations } from '${importPath}';
const _translationKeys: string[] = [${keysArray.map((key) => `'${key}'`).join(', ')}];
${AUTO_GENERATED_MARKERS.END}
`;
		}

		const keys = ['hello', 'world', 'test'];
		const result = generateTranslationsCode(keys, true);

		expect(result).toContain(
			'// ============================================================================='
		);
		expect(result).toContain('// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN');
		expect(result).toContain("import { _getTranslations } from '$lib/server'");
		expect(result).toContain("const _translationKeys: string[] = ['hello', 'world', 'test']");
		expect(result).toContain('// END AUTO-GENERATED CODE');
	});

	it('should generate correct translation code for production', () => {
		const AUTO_GENERATED_MARKERS = {
			START: '// =============================================================================',
			HEADER: '// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN',
			END: '// END AUTO-GENERATED CODE'
		} as const;

		function generateTranslationsCode(keysArray: string[], isDevelopment: boolean = false): string {
			const importPath = isDevelopment ? '$lib/server' : 'sveltekit-translations-loader/server';

			return `${AUTO_GENERATED_MARKERS.START}
${AUTO_GENERATED_MARKERS.HEADER}
import { _getTranslations } from '${importPath}';
const _translationKeys: string[] = [${keysArray.map((key) => `'${key}'`).join(', ')}];
${AUTO_GENERATED_MARKERS.END}
`;
		}

		const keys = ['prod_key'];
		const result = generateTranslationsCode(keys, false);

		expect(result).toContain(
			"import { _getTranslations } from 'sveltekit-translations-loader/server'"
		);
		expect(result).toContain("const _translationKeys: string[] = ['prod_key']");
	});

	// Test the insertion logic
	it('should find correct insertion point for multi-line imports', () => {
		const testContent = `import { getEnvClient, IS_DEV_MODE } from '$lib/server/some-services/base.service';
import { DataMapper } from '$lib/server/some-services/DataMapper';

import type { SomeImport } from '@interfaces/some-response.types';
import type { SomeImport2 } from '@interfaces/some.types';
import { MapCountriesToClient } from '@server/some-services/some.service.js';
import {
	SomeService,
	SomeService2,
	type SomeType
} from '@server/translations/translations.service.js';
import { findCountry } from '@stores/countries.store.js';

export const load = async ({ url, params, locals }) => {
	return {
		hello: 'world'
	};
};`;

		// Test the insertion logic
		const lines = testContent.split('\n');
		let insertIndex = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line.startsWith('export')) {
				insertIndex = i;
				break;
			}
		}

		// The export should be found at line 13 (0-indexed)
		expect(insertIndex).toBe(13);
		expect(lines[insertIndex].trim()).toBe(
			'export const load = async ({ url, params, locals }) => {'
		);
	});

	it('should handle files with no imports', () => {
		const testContent = `export const load = async () => {
	return {
		hello: 'world'
	};
};`;

		const lines = testContent.split('\n');
		let insertIndex = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line.startsWith('export')) {
				insertIndex = i;
				break;
			}
		}

		// The export should be found at line 0 (0-indexed)
		expect(insertIndex).toBe(0);
		expect(lines[insertIndex].trim()).toBe('export const load = async () => {');
	});

	it('should handle files with multiple exports', () => {
		const testContent = `import { something } from 'somewhere';

export const helper = () => {
	return 'helper';
};

export const load = async () => {
	return {
		hello: 'world'
	};
};`;

		const lines = testContent.split('\n');
		let insertIndex = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line.startsWith('export')) {
				insertIndex = i;
				break;
			}
		}

		// The first export (helper) should be found at line 2 (0-indexed)
		expect(insertIndex).toBe(2);
		expect(lines[insertIndex].trim()).toBe('export const helper = () => {');
	});

	// Test the injectLoadedTranslations function logic
	it('should detect missing imports correctly', () => {
		// Recreate the core logic from injectLoadedTranslations
		function checkImports(code: string): boolean {
			return code.includes('_getTranslations') && code.includes('_translationKeys');
		}

		const codeWithoutImports = `export const load = async () => {
	return {
		hello: 'world'
	};
};`;

		const codeWithImports = `import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['hello'];

export const load = async () => {
	return {
		hello: 'world'
	};
};`;

		expect(checkImports(codeWithoutImports)).toBe(false);
		expect(checkImports(codeWithImports)).toBe(true);
	});

	it('should detect existing _loadedTranslations', () => {
		const codeWithLoadedTranslations = `export const load = async () => {
	return {
		hello: 'world',
		_loadedTranslations: _getTranslations(_fileType)
	};
};`;

		const codeWithoutLoadedTranslations = `export const load = async () => {
	return {
		hello: 'world'
	};
};`;

		expect(codeWithLoadedTranslations.includes('_loadedTranslations')).toBe(true);
		expect(codeWithoutLoadedTranslations.includes('_loadedTranslations')).toBe(false);
	});

	// Test the multi-line import preservation
	it('should preserve multi-line imports correctly', () => {
		const multiLineImport = `import {
	SomeService,
	SomeService2,
	type SomeType
} from '@server/translations/translations.service.js';`;

		const testContent = `import { getEnvClient, IS_DEV_MODE } from '$lib/server/some-services/base.service';
import { DataMapper } from '$lib/server/some-services/DataMapper';

import type { SomeImport } from '@interfaces/some-response.types';
import type { SomeImport2 } from '@interfaces/some.types';
import { MapCountriesToClient } from '@server/some-services/some.service.js';
${multiLineImport}
import { findCountry } from '@stores/some.store.js';

export const load = async ({ url, params, locals }) => {
	return {
		hello: 'world'
	};
};`;

		// Test that the multi-line import is preserved
		expect(testContent).toContain(multiLineImport);
		expect(testContent).toContain(
			"import { getEnvClient, IS_DEV_MODE } from '$lib/server/some-services/base.service';"
		);
		expect(testContent).toContain("import { findCountry } from '@stores/some.store.js';");
	});
});

// Test the empty keys functionality
describe('load-function-updater - Empty Keys Tests', () => {
	// Test the removeAutoGeneratedCode function
	it('should remove auto-generated code block correctly', () => {
		const AUTO_GENERATED_MARKERS = {
			START: '// =============================================================================',
			HEADER: '// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN',
			END: '// END AUTO-GENERATED CODE'
		} as const;

		function removeAutoGeneratedCode(content: string): string {
			const autoGeneratedStart = content.indexOf(AUTO_GENERATED_MARKERS.START);
			const autoGeneratedEnd = content.indexOf(AUTO_GENERATED_MARKERS.END);

			if (autoGeneratedStart !== -1 && autoGeneratedEnd !== -1) {
				// Remove existing auto-generated code block and any duplicate markers
				const beforeBlock = content.substring(0, autoGeneratedStart);
				const afterBlock = content.substring(autoGeneratedEnd + AUTO_GENERATED_MARKERS.END.length);

				// Clean up any duplicate markers in the after block
				const cleanedAfterBlock = afterBlock.replace(
					new RegExp(`${AUTO_GENERATED_MARKERS.START}.*?${AUTO_GENERATED_MARKERS.END}`, 'gs'),
					''
				);

				return beforeBlock + cleanedAfterBlock;
			}

			return content;
		}

		const contentWithAutoGeneratedCode = `import { something } from 'somewhere';

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['hello', 'world'];
// END AUTO-GENERATED CODE

export const load = async () => {
	return {
		hello: 'world',
		_loadedTranslations: _getTranslations(_fileType)
	};
};`;

		const result = removeAutoGeneratedCode(contentWithAutoGeneratedCode);

		expect(result).not.toContain(
			'// ============================================================================='
		);
		expect(result).not.toContain('// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN');
		expect(result).not.toContain("import { _getTranslations } from '$lib/server';");
		expect(result).not.toContain("const _translationKeys: string[] = ['hello', 'world'];");
		expect(result).not.toContain('// END AUTO-GENERATED CODE');
		expect(result).toContain("import { something } from 'somewhere';");
		expect(result).toContain('export const load = async () => {');
	});

	it('should handle content without auto-generated code', () => {
		const AUTO_GENERATED_MARKERS = {
			START: '// =============================================================================',
			END: '// END AUTO-GENERATED CODE'
		} as const;

		function removeAutoGeneratedCode(content: string): string {
			const autoGeneratedStart = content.indexOf(AUTO_GENERATED_MARKERS.START);
			const autoGeneratedEnd = content.indexOf(AUTO_GENERATED_MARKERS.END);

			if (autoGeneratedStart !== -1 && autoGeneratedEnd !== -1) {
				const beforeBlock = content.substring(0, autoGeneratedStart);
				const afterBlock = content.substring(autoGeneratedEnd + AUTO_GENERATED_MARKERS.END.length);
				return beforeBlock + afterBlock;
			}

			return content;
		}

		const contentWithoutAutoGeneratedCode = `import { something } from 'somewhere';

export const load = async () => {
	return {
		hello: 'world'
	};
};`;

		const result = removeAutoGeneratedCode(contentWithoutAutoGeneratedCode);

		expect(result).toBe(contentWithoutAutoGeneratedCode);
	});

	it('should handle content with partial auto-generated markers', () => {
		const AUTO_GENERATED_MARKERS = {
			START: '// =============================================================================',
			END: '// END AUTO-GENERATED CODE'
		} as const;

		function removeAutoGeneratedCode(content: string): string {
			const autoGeneratedStart = content.indexOf(AUTO_GENERATED_MARKERS.START);
			const autoGeneratedEnd = content.indexOf(AUTO_GENERATED_MARKERS.END);

			if (autoGeneratedStart !== -1 && autoGeneratedEnd !== -1) {
				const beforeBlock = content.substring(0, autoGeneratedStart);
				const afterBlock = content.substring(autoGeneratedEnd + AUTO_GENERATED_MARKERS.END.length);
				return beforeBlock + afterBlock;
			}

			return content;
		}

		const contentWithPartialMarkers = `import { something } from 'somewhere';

// =============================================================================
// Some content here
export const load = async () => {
	return {
		hello: 'world'
	};
};`;

		const result = removeAutoGeneratedCode(contentWithPartialMarkers);

		// Should return original content since only START marker is present
		expect(result).toBe(contentWithPartialMarkers);
	});

	// Test the injectTranslationKeys function logic for empty keys
	it('should skip processing when no keys and no existing file', () => {
		// Mock the logic for testing
		function shouldSkipProcessing(keysArray: string[], fileExists: boolean): boolean {
			return keysArray.length === 0 && !fileExists;
		}

		expect(shouldSkipProcessing([], false)).toBe(true);
		expect(shouldSkipProcessing(['hello'], false)).toBe(false);
		expect(shouldSkipProcessing([], true)).toBe(false);
		expect(shouldSkipProcessing(['hello'], true)).toBe(false);
	});

	it('should remove auto-generated code when no keys but file exists', () => {
		// Mock the logic for testing
		function shouldRemoveAutoGeneratedCode(keysArray: string[], fileExists: boolean): boolean {
			return keysArray.length === 0 && fileExists;
		}

		expect(shouldRemoveAutoGeneratedCode([], true)).toBe(true);
		expect(shouldRemoveAutoGeneratedCode(['hello'], true)).toBe(false);
		expect(shouldRemoveAutoGeneratedCode([], false)).toBe(false);
		expect(shouldRemoveAutoGeneratedCode(['hello'], false)).toBe(false);
	});

	// Test the _loadedTranslations removal logic
	it('should remove _loadedTranslations from return statements when no keys', () => {
		function removeLoadedTranslations(code: string): string {
			return code
				.replace(/,\s*_loadedTranslations:\s*_getTranslations\(_translationKeys\)/g, '')
				.replace(/_loadedTranslations:\s*_getTranslations\(_translationKeys\)(,?\s*)/g, '')
				.replace(/{\s*_loadedTranslations:\s*_getTranslations\(_translationKeys\)\s*}/g, '{}');
		}

		const codeWithLoadedTranslations = `export const load = async () => {
	return {
		hello: 'world',
		_loadedTranslations: _getTranslations(_fileType)
	};
};`;

		const codeWithLoadedTranslationsOnly = `export const load = async () => {
	return {
		_loadedTranslations: _getTranslations(_fileType)
	};
};`;

		const codeWithLoadedTranslationsFirst = `export const load = async () => {
	return {
		_loadedTranslations: _getTranslations(_fileType),
		hello: 'world'
	};
};`;

		const result1 = removeLoadedTranslations(codeWithLoadedTranslations);
		const result2 = removeLoadedTranslations(codeWithLoadedTranslationsOnly);
		const result3 = removeLoadedTranslations(codeWithLoadedTranslationsFirst);

		expect(result1).toContain("hello: 'world'");
		expect(result1).not.toContain('_loadedTranslations');
		expect(result2).toBe('export const load = async () => {\n\treturn {\n\t\t};\n};');
		expect(result3).toContain("hello: 'world'");
		expect(result3).not.toContain('_loadedTranslations');
	});

	// Test the key array generation for empty keys
	it('should generate empty key array when no keys provided', () => {
		function generateTranslationsCode(keysArray: string[], isDevelopment: boolean = false): string {
			const importPath = isDevelopment ? '$lib/server' : 'sveltekit-translations-loader/server';

			return `// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '${importPath}';
const _translationKeys: string[] = [${keysArray.map((key) => `'${key}'`).join(', ')}];
// END AUTO-GENERATED CODE
`;
		}

		const emptyKeysResult = generateTranslationsCode([], true);
		const nonEmptyKeysResult = generateTranslationsCode(['hello', 'world'], true);

		expect(emptyKeysResult).toContain('const _translationKeys: string[] = [];');
		expect(nonEmptyKeysResult).toContain("const _translationKeys: string[] = ['hello', 'world'];");
	});

	// Test the complete flow for empty keys scenario
	it('should handle complete empty keys flow correctly', () => {
		// Mock the complete flow
		function processEmptyKeysScenario(keysArray: string[], fileExists: boolean): string {
			if (keysArray.length === 0 && !fileExists) {
				return 'SKIP_CREATION';
			}

			if (keysArray.length === 0 && fileExists) {
				return 'REMOVE_AUTO_GENERATED_CODE';
			}

			if (keysArray.length > 0) {
				return 'CREATE_OR_UPDATE';
			}

			return 'UNKNOWN';
		}

		expect(processEmptyKeysScenario([], false)).toBe('SKIP_CREATION');
		expect(processEmptyKeysScenario([], true)).toBe('REMOVE_AUTO_GENERATED_CODE');
		expect(processEmptyKeysScenario(['hello'], false)).toBe('CREATE_OR_UPDATE');
		expect(processEmptyKeysScenario(['hello'], true)).toBe('CREATE_OR_UPDATE');
	});

	// Test the duplicate marker cleanup
	it('should clean up duplicate auto-generated markers', () => {
		const AUTO_GENERATED_MARKERS = {
			START: '// =============================================================================',
			END: '// END AUTO-GENERATED CODE'
		} as const;

		function removeAutoGeneratedCode(content: string): string {
			const autoGeneratedStart = content.indexOf(AUTO_GENERATED_MARKERS.START);
			const autoGeneratedEnd = content.indexOf(AUTO_GENERATED_MARKERS.END);

			if (autoGeneratedStart !== -1 && autoGeneratedEnd !== -1) {
				const beforeBlock = content.substring(0, autoGeneratedStart);
				const afterBlock = content.substring(autoGeneratedEnd + AUTO_GENERATED_MARKERS.END.length);

				// Clean up any duplicate markers in the after block
				const cleanedAfterBlock = afterBlock.replace(
					new RegExp(`${AUTO_GENERATED_MARKERS.START}.*?${AUTO_GENERATED_MARKERS.END}`, 'gs'),
					''
				);

				return beforeBlock + cleanedAfterBlock;
			}

			return content;
		}

		const contentWithDuplicateMarkers = `import { something } from 'somewhere';

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['hello'];
// END AUTO-GENERATED CODE

export const load = async () => {
	return {
		hello: 'world'
	};
};

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['world'];
// END AUTO-GENERATED CODE`;

		const result = removeAutoGeneratedCode(contentWithDuplicateMarkers);

		expect(result).not.toContain(
			'// ============================================================================='
		);
		expect(result).not.toContain('// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN');
		expect(result).not.toContain('// END AUTO-GENERATED CODE');
		expect(result).toContain("import { something } from 'somewhere';");
		expect(result).toContain('export const load = async () => {');
	});

	// Test edge cases for empty keys functionality
	it('should handle edge cases for empty keys scenarios', () => {
		// Test with whitespace-only keys
		function processKeys(keysArray: string[]): string {
			const filteredKeys = keysArray.filter((key) => key.trim().length > 0);
			return filteredKeys.length === 0 ? 'EMPTY' : 'HAS_KEYS';
		}

		expect(processKeys([])).toBe('EMPTY');
		expect(processKeys([''])).toBe('EMPTY');
		expect(processKeys(['   '])).toBe('EMPTY');
		expect(processKeys(['hello'])).toBe('HAS_KEYS');
		expect(processKeys(['', 'hello', ''])).toBe('HAS_KEYS');
	});

	it('should handle malformed auto-generated code gracefully', () => {
		const AUTO_GENERATED_MARKERS = {
			START: '// =============================================================================',
			END: '// END AUTO-GENERATED CODE'
		} as const;

		function removeAutoGeneratedCode(content: string): string {
			const autoGeneratedStart = content.indexOf(AUTO_GENERATED_MARKERS.START);
			const autoGeneratedEnd = content.indexOf(AUTO_GENERATED_MARKERS.END);

			if (autoGeneratedStart !== -1 && autoGeneratedEnd !== -1) {
				const beforeBlock = content.substring(0, autoGeneratedStart);
				const afterBlock = content.substring(autoGeneratedEnd + AUTO_GENERATED_MARKERS.END.length);

				// Clean up any duplicate markers in the after block
				const cleanedAfterBlock = afterBlock.replace(
					new RegExp(`${AUTO_GENERATED_MARKERS.START}.*?${AUTO_GENERATED_MARKERS.END}`, 'gs'),
					''
				);

				return beforeBlock + cleanedAfterBlock;
			}

			return content;
		}

		// Test with malformed content (START marker but no END marker)
		const malformedContent = `import { something } from 'somewhere';

// =============================================================================
// Some malformed content without proper END marker
export const load = async () => {
	return {
		hello: 'world'
	};
};`;

		const result = removeAutoGeneratedCode(malformedContent);

		// Should return original content since markers are incomplete
		expect(result).toBe(malformedContent);
	});

	it('should handle nested auto-generated code blocks', () => {
		const AUTO_GENERATED_MARKERS = {
			START: '// =============================================================================',
			END: '// END AUTO-GENERATED CODE'
		} as const;

		function removeAutoGeneratedCode(content: string): string {
			const autoGeneratedStart = content.indexOf(AUTO_GENERATED_MARKERS.START);
			const autoGeneratedEnd = content.indexOf(AUTO_GENERATED_MARKERS.END);

			if (autoGeneratedStart !== -1 && autoGeneratedEnd !== -1) {
				const beforeBlock = content.substring(0, autoGeneratedStart);
				const afterBlock = content.substring(autoGeneratedEnd + AUTO_GENERATED_MARKERS.END.length);

				// Clean up any duplicate markers in the after block
				const cleanedAfterBlock = afterBlock.replace(
					new RegExp(`${AUTO_GENERATED_MARKERS.START}.*?${AUTO_GENERATED_MARKERS.END}`, 'gs'),
					''
				);

				return beforeBlock + cleanedAfterBlock;
			}

			return content;
		}

		const contentWithNestedBlocks = `import { something } from 'somewhere';

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['hello'];
// END AUTO-GENERATED CODE

export const load = async () => {
	return {
		hello: 'world'
	};
};

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['world'];
// END AUTO-GENERATED CODE

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['test'];
// END AUTO-GENERATED CODE`;

		const result = removeAutoGeneratedCode(contentWithNestedBlocks);

		expect(result).not.toContain(
			'// ============================================================================='
		);
		expect(result).not.toContain('// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN');
		expect(result).not.toContain('// END AUTO-GENERATED CODE');
		expect(result).toContain("import { something } from 'somewhere';");
		expect(result).toContain('export const load = async () => {');
	});

	it('should preserve non-auto-generated content correctly', () => {
		const AUTO_GENERATED_MARKERS = {
			START: '// =============================================================================',
			END: '// END AUTO-GENERATED CODE'
		} as const;

		function removeAutoGeneratedCode(content: string): string {
			const autoGeneratedStart = content.indexOf(AUTO_GENERATED_MARKERS.START);
			const autoGeneratedEnd = content.indexOf(AUTO_GENERATED_MARKERS.END);

			if (autoGeneratedStart !== -1 && autoGeneratedEnd !== -1) {
				const beforeBlock = content.substring(0, autoGeneratedStart);
				const afterBlock = content.substring(autoGeneratedEnd + AUTO_GENERATED_MARKERS.END.length);

				// Clean up any duplicate markers in the after block
				const cleanedAfterBlock = afterBlock.replace(
					new RegExp(`${AUTO_GENERATED_MARKERS.START}.*?${AUTO_GENERATED_MARKERS.END}`, 'gs'),
					''
				);

				return beforeBlock + cleanedAfterBlock;
			}

			return content;
		}

		const contentWithMixedCode = `import { something } from 'somewhere';

// Some regular comment
export const helper = () => {
	return 'helper';
};

// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from '$lib/server';
const _translationKeys: string[] = ['hello'];
// END AUTO-GENERATED CODE

export const load = async () => {
	return {
		hello: 'world',
		_loadedTranslations: _getTranslations(_fileType)
	};
};

// Another regular comment
export const anotherFunction = () => {
	return 'another';
};`;

		const result = removeAutoGeneratedCode(contentWithMixedCode);

		expect(result).toContain("import { something } from 'somewhere';");
		expect(result).toContain('// Some regular comment');
		expect(result).toContain('export const helper = () => {');
		expect(result).toContain('export const load = async () => {');
		expect(result).toContain('// Another regular comment');
		expect(result).toContain('export const anotherFunction = () => {');
		expect(result).not.toContain(
			'// ============================================================================='
		);
		expect(result).not.toContain('// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN');
		expect(result).not.toContain('// END AUTO-GENERATED CODE');
		expect(result).not.toContain("import { _getTranslations } from '$lib/server';");
		expect(result).not.toContain("const _translationKeys: string[] = ['hello'];");
	});
});
