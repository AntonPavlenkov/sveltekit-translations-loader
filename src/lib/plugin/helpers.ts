// Utility functions for the sveltekit-translations-loader plugin

// Constants
const ROUTE_FILE_PATTERNS = [
	/\/\+page\.svelte$/,
	/\/\+layout\.svelte$/,
	/\/\+page\.server\.ts$/,
	/\/\+layout\.server\.ts$/
] as const;

// Types
interface TranslationEntry {
	key: string;
	value: string;
	safeFunctionName: string;
	hasPlaceholders: boolean;
}

interface TypeScriptDeclaration {
	functionName: string;
	hasParams: boolean;
	description: string;
}

// JavaScript reserved words and built-in identifiers that cannot be used as function names
const JAVASCRIPT_RESERVED_WORDS = new Set([
	// JavaScript keywords
	'break',
	'case',
	'catch',
	'class',
	'const',
	'continue',
	'debugger',
	'default',
	'delete',
	'do',
	'else',
	'export',
	'extends',
	'finally',
	'for',
	'function',
	'if',
	'import',
	'in',
	'instanceof',
	'let',
	'new',
	'return',
	'super',
	'switch',
	'this',
	'throw',
	'try',
	'typeof',
	'var',
	'void',
	'while',
	'with',
	'yield',

	// Future reserved words
	'enum',
	'implements',
	'interface',
	'package',
	'private',
	'protected',
	'public',
	'static',

	// Global objects and functions
	'Array',
	'Boolean',
	'Date',
	'Error',
	'Function',
	'JSON',
	'Math',
	'Number',
	'Object',
	'RegExp',
	'String',
	'Symbol',
	'console',
	'window',
	'document',
	'global',
	'process',

	// Common browser globals that might cause conflicts
	'alert',
	'confirm',
	'prompt',
	'setTimeout',
	'setInterval',
	'clearTimeout',
	'clearInterval',
	'localStorage',
	'sessionStorage',
	'fetch',
	'XMLHttpRequest',

	// Node.js globals
	'require',
	'module',
	'exports',
	'__dirname',
	'__filename',
	'Buffer',

	// Common method names that might cause conflicts
	'toString',
	'valueOf',
	'hasOwnProperty',
	'isPrototypeOf',
	'propertyIsEnumerable',
	'constructor',
	'prototype',
	'length',
	'name'
]);

/**
 * Check if a name is a JavaScript reserved word or conflicts with built-in identifiers
 */
function isReservedWord(name: string): boolean {
	return JAVASCRIPT_RESERVED_WORDS.has(name);
}

/**
 * Convert kebab-case or other formats to camelCase for function names
 * Handles JavaScript reserved words by appending 'Fn' suffix
 */
export function sanitizeFunctionName(key: string): string {
	// First convert to camelCase
	let camelCase = key.replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));

	// Handle reserved words by appending 'Fn' suffix
	if (isReservedWord(camelCase)) {
		camelCase = camelCase + 'Fn';
	}

	return camelCase;
}

/**
 * Check if a translation key requires safe access (reserved word)
 */
export function requiresSafeAccess(key: string): boolean {
	const functionName = key.replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
	return isReservedWord(functionName);
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
	return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 */
function kebabToCamel(str: string): string {
	return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Check if a string has placeholder patterns
 */
function hasPlaceholders(value: string): boolean {
	return value.includes('{{');
}

/**
 * Create a safe function name from a translation key
 */
function createSafeFunctionName(key: string): string {
	return sanitizeFunctionName(key);
}

/**
 * Convert file path to route path
 */
export function getRoutePath(filePath: string, routesDir: string): string {
	const relativePath = filePath.replace(routesDir, '').replace(/^\//, '');

	// Remove route file patterns
	const routePath = ROUTE_FILE_PATTERNS.reduce(
		(path, pattern) => path.replace(pattern, ''),
		relativePath
	);

	return routePath || '/';
}

/**
 * Check if a key exists in available translations
 */
function keyExists(key: string, availableKeys: string[]): boolean {
	return availableKeys.includes(key);
}

/**
 * Find matching key variations
 */
function findKeyVariations(usedKey: string, availableKeys: string[]): string[] {
	const matches: string[] = [];

	// Check exact match
	if (keyExists(usedKey, availableKeys)) {
		matches.push(usedKey);
		return matches;
	}

	// Check kebab-case variation
	const kebabKey = camelToKebab(usedKey);
	const kebabKeyTrimmed = kebabKey.startsWith('-') ? kebabKey.substring(1) : kebabKey;

	if (keyExists(kebabKeyTrimmed, availableKeys)) {
		matches.push(kebabKeyTrimmed);
	}

	// Check if any available key converts to this camelCase
	for (const availableKey of availableKeys) {
		const camelCaseKey = sanitizeFunctionName(availableKey);
		if (camelCaseKey === usedKey) {
			matches.push(availableKey);
		}
	}

	return matches;
}

/**
 * Helper function to resolve actual translation keys from usage
 */
export function resolveTranslationKeys(
	usedKeys: Set<string>,
	availableTranslations: Record<string, string>
): Set<string> {
	const resolvedKeys = new Set<string>();
	const availableKeys = Object.keys(availableTranslations);

	for (const usedKey of usedKeys) {
		const matches = findKeyVariations(usedKey, availableKeys);
		matches.forEach((match) => resolvedKeys.add(match));
	}

	return resolvedKeys;
}

/**
 * Create translation entry with metadata
 */
function createTranslationEntry(key: string, value: string): TranslationEntry {
	return {
		key,
		value,
		safeFunctionName: createSafeFunctionName(key),
		hasPlaceholders: hasPlaceholders(value)
	};
}

/**
 * Replace function body in code
 */
function replaceFunctionBody(
	code: string,
	functionName: string,
	escapedValue: string,
	hasParams: boolean
): string {
	if (hasParams) {
		// Replace parameterized function: const functionName = (params?: ...) => r("default value", params);
		const parameterizedRegex = new RegExp(
			`(const ${functionName} = \\(params\\?: Record<string, string \\| number>\\): string => r\\()([^,]+)(, params\\);)`,
			'g'
		);
		return code.replace(parameterizedRegex, `$1${escapedValue}$3`);
	} else {
		// Replace simple function: const functionName = (): string => "default value";
		const simpleRegex = new RegExp(`(const ${functionName} = \\(\\): string => )([^;]+)(;)`, 'g');
		return code.replace(simpleRegex, `$1${escapedValue}$3`);
	}
}

/**
 * Transform translation code based on locale and translations
 */
export function transformTranslationCode(
	code: string,
	locale: string,
	translations: Record<string, string>
): string {
	let transformedCode = code;

	Object.entries(translations).forEach(([key, value]) => {
		const entry = createTranslationEntry(key, value);
		const escapedValue = JSON.stringify(value);

		transformedCode = replaceFunctionBody(
			transformedCode,
			entry.safeFunctionName,
			escapedValue,
			entry.hasPlaceholders
		);
	});

	return transformedCode;
}

/**
 * Generate TypeScript declaration for a single translation
 */
function generateSingleDeclaration(entry: TranslationEntry): TypeScriptDeclaration {
	return {
		functionName: entry.safeFunctionName,
		hasParams: entry.hasPlaceholders,
		description: entry.value
	};
}

/**
 * Generate TypeScript declaration code
 */
function generateDeclarationCode(declaration: TypeScriptDeclaration): string {
	const { functionName, hasParams, description } = declaration;
	const paramType = hasParams ? '(params?: TranslationParams) => string' : '() => string';

	return `/**
 * @description ${description}
 */
export declare const ${functionName}: ${paramType};
`;
}

/**
 * Generate additional camelCase declarations for kebab-case keys
 */
function generateCamelCaseDeclarations(entry: TranslationEntry): TypeScriptDeclaration[] {
	const camelKey = kebabToCamel(entry.key);

	if (camelKey !== entry.key && camelKey !== entry.safeFunctionName) {
		return [
			{
				functionName: camelKey,
				hasParams: entry.hasPlaceholders,
				description: entry.value
			}
		];
	}

	return [];
}

/**
 * Generate TypeScript declarations for translations
 */
export function generateTypeScriptDeclarations(translationsData: Record<string, string>): string {
	const entries = Object.entries(translationsData).map(([key, value]) =>
		createTranslationEntry(key, value)
	);

	let code = '// Auto-generated TypeScript declarations\n';
	code += 'interface TranslationParams {\n';
	code += '\t[key: string]: string | number;\n';
	code += '}\n\n';

	// Generate declarations for all entries
	const allDeclarations: TypeScriptDeclaration[] = [];

	entries.forEach((entry) => {
		// Main declaration
		allDeclarations.push(generateSingleDeclaration(entry));

		// Additional camelCase declarations
		const camelDeclarations = generateCamelCaseDeclarations(entry);
		allDeclarations.push(...camelDeclarations);
	});

	// Generate code for all declarations
	allDeclarations.forEach((declaration) => {
		code += generateDeclarationCode(declaration) + '\n';
	});

	return code;
}
