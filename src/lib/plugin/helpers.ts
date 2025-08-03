// Utility functions for the sveltekit-translations-loader plugin

/**
 * Convert kebab-case or other formats to camelCase for function names
 */
export function sanitizeFunctionName(key: string): string {
	return key.replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
}

/**
 * Convert file path to route path
 */
export function getRoutePath(filePath: string, routesDir: string): string {
	const relativePath = filePath.replace(routesDir, '').replace(/^\//, '');
	const routePath = relativePath
		.replace(/\/\+page\.svelte$/, '')
		.replace(/\/\+layout\.svelte$/, '')
		.replace(/\/\+page\.server\.ts$/, '')
		.replace(/\/\+layout\.server\.ts$/, '');

	return routePath || '/';
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
		// Check if key exists as-is
		if (availableKeys.includes(usedKey)) {
			resolvedKeys.add(usedKey);
		} else {
			// Convert camelCase to kebab-case and check
			const kebabKey = usedKey.replace(/([A-Z])/g, '-$1').toLowerCase();
			const kebabKeyTrimmed = kebabKey.startsWith('-') ? kebabKey.substring(1) : kebabKey;

			if (availableKeys.includes(kebabKeyTrimmed)) {
				resolvedKeys.add(kebabKeyTrimmed);
			}

			// Also check if any available key converts to this camelCase
			for (const availableKey of availableKeys) {
				const camelCaseKey = sanitizeFunctionName(availableKey);
				if (camelCaseKey === usedKey) {
					resolvedKeys.add(availableKey);
				}
			}
		}
	}

	return resolvedKeys;
}
/**
 * Transform translation code based on locale and translations
 */
export function transformTranslationCode(
	code: string,
	locale: string,
	translations: Record<string, string>
): string {
	// Replace translation values in the generated code based on locale
	let transformedCode = code;

	Object.entries(translations).forEach(([key, value]) => {
		const safeFunctionName = sanitizeFunctionName(key);
		const escapedValue = JSON.stringify(value);

		// Replace function bodies with locale-specific translations
		// Match: const functionName = (params?: ...) => r("default value", params);
		const parameterizedRegex = new RegExp(
			`(const ${safeFunctionName} = \\(params\\?: Record<string, string \\| number>\\): string => r\\()([^,]+)(, params\\);)`,
			'g'
		);
		transformedCode = transformedCode.replace(parameterizedRegex, `$1${escapedValue}$3`);

		// Match: const functionName = (): string => "default value";
		const simpleRegex = new RegExp(
			`(const ${safeFunctionName} = \\(\\): string => )([^;]+)(;)`,
			'g'
		);
		transformedCode = transformedCode.replace(simpleRegex, `$1${escapedValue}$3`);
	});

	return transformedCode;
}

/**
 * Generate TypeScript declarations for translations
 */
export function generateTypeScriptDeclarations(translationsData: Record<string, string>): string {
	const entries = Object.entries(translationsData);

	let code = '// Auto-generated TypeScript declarations\n';
	code += 'interface TranslationParams {\n';
	code += '\t[key: string]: string | number;\n';
	code += '}\n\n';

	// Generate individual export declarations
	entries.forEach(([key, value]) => {
		const safeFunctionName = sanitizeFunctionName(key);
		const hasPlaceholders = value.includes('{{');

		code += `/**\n * @description ${value}\n */\n`;

		if (hasPlaceholders) {
			code += `export declare const ${safeFunctionName}: (params?: TranslationParams) => string;\n\n`;
		} else {
			code += `export declare const ${safeFunctionName}: () => string;\n\n`;
		}

		// Declare camelCase versions for kebab-case keys
		const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
		if (camelKey !== key && camelKey !== safeFunctionName) {
			code += `export declare const ${camelKey}: ${hasPlaceholders ? '(params?: TranslationParams) => string' : '() => string'};\n\n`;
		}
	});

	return code;
}
