import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Constants
const AUTO_GENERATED_MARKERS = {
	START: '// =============================================================================',
	HEADER: '// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN',
	END: '// END AUTO-GENERATED CODE'
} as const;

interface LoadFunctionConfig {
	loadType: string;
	existingReturnContent: string;
}

/**
 * Get content hash for change detection
 */
function getContentHash(content: string): string {
	// Simple hash function for change detection
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return hash.toString();
}

/**
 * Check if content has actually changed
 */
function hasContentChanged(filePath: string, newContent: string): boolean {
	if (!existsSync(filePath)) {
		return true; // File doesn't exist, so it's a change
	}

	try {
		const existingContent = readFileSync(filePath, 'utf8');
		const existingHash = getContentHash(existingContent);
		const newHash = getContentHash(newContent);
		return existingHash !== newHash;
	} catch {
		// If we can't read the existing file, assume it changed
		return true;
	}
}

/**
 * Clean and format existing return content
 */
function cleanReturnContent(content: string): string {
	return content
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.includes('_loadedTranslations'))
		.map((line) => line.replace(/,$/, ''))
		.join(', ');
}

/**
 * Extract existing return content from load function code with support for complex patterns
 */
function extractReturnContent(loadFunctionCode: string): string {
	// Handle multiple return statements and complex logic
	const lines = loadFunctionCode.split('\n');
	let inReturnBlock = false;
	let braceCount = 0;
	const returnContent: string[] = [];
	let foundReturn = false;

	for (const line of lines) {
		const trimmedLine = line.trim();

		// Check for return statement start
		if (trimmedLine.startsWith('return') && !foundReturn) {
			foundReturn = true;
			inReturnBlock = true;
			braceCount = 0;

			// Handle inline return: return { prop: value };
			const inlineMatch = trimmedLine.match(/return\s*\{([^}]*)\}/);
			if (inlineMatch) {
				return cleanReturnContent(inlineMatch[1]);
			}

			// Handle multi-line return: return { ... }
			const openBraceMatch = trimmedLine.match(/return\s*\{/);
			if (openBraceMatch) {
				braceCount = 1;
				continue;
			}
		}

		if (inReturnBlock) {
			// Count braces to find the end of the return object
			braceCount += (line.match(/\{/g) || []).length;
			braceCount -= (line.match(/\}/g) || []).length;

			if (braceCount > 0) {
				// We're inside the return object
				returnContent.push(line);
			} else if (braceCount === 0) {
				// End of return object - don't include the closing brace line
				break;
			}
		}
	}

	if (returnContent.length > 0) {
		const fullReturnContent = returnContent.join('\n');
		// Extract content between the outermost braces, excluding the braces themselves
		const match = fullReturnContent.match(/\{([\s\S]*)/);
		if (match) {
			return cleanReturnContent(match[1]);
		}
	}

	return '';
}

/**
 * Generate the auto-generated code block with proper import path
 */
function generateTranslationsCode(keysArray: string[]): string {
	return `${AUTO_GENERATED_MARKERS.START}
${AUTO_GENERATED_MARKERS.HEADER}
import { _getTranslations } from 'sveltekit-translations-loader/server';
const _translationKeys: string[] = [${keysArray.map((key) => `'${key}'`).join(', ')}];
${AUTO_GENERATED_MARKERS.END}
${AUTO_GENERATED_MARKERS.START}
`;
}

/**
 * Create load function code
 */
function createLoadFunction(config: LoadFunctionConfig): string {
	const { loadType, existingReturnContent } = config;
	const returnContent = existingReturnContent
		? `${existingReturnContent},\n\t\t_loadedTranslations: _getTranslations(_translationKeys)`
		: `_loadedTranslations: _getTranslations(_translationKeys)`;

	return `export const load: ${loadType} = async () => {
	return {
		${returnContent}
	};
}`;
}

/**
 * Get Prettier configuration
 */
async function getPrettierConfig(): Promise<Record<string, unknown>> {
	try {
		const configPath = resolve(process.cwd(), '.prettierrc');
		if (existsSync(configPath)) {
			const configContent = readFileSync(configPath, 'utf8');
			return JSON.parse(configContent);
		}
	} catch {
		console.log('ℹ️  Could not read Prettier config, using defaults');
	}

	return {};
}

/**
 * Format a file using Prettier (optional)
 */
async function formatFile(filePath: string, content: string): Promise<string> {
	try {
		const prettier = await import('prettier').catch(() => null);
		if (!prettier) {
			console.log('ℹ️  Prettier not available, writing file without formatting');
			return content;
		}

		const prettierConfig = await getPrettierConfig();

		const formattedContent = await prettier.format(content, {
			filepath: filePath,
			parser: 'typescript',
			...prettierConfig,
			// Fallback defaults
			semi: (prettierConfig.semi as boolean) ?? true,
			singleQuote: (prettierConfig.singleQuote as boolean) ?? true,
			tabWidth: (prettierConfig.tabWidth as number) ?? 2,
			useTabs: (prettierConfig.useTabs as boolean) ?? true,
			trailingComma: (prettierConfig.trailingComma as 'none' | 'es5' | 'all') ?? 'none',
			printWidth: (prettierConfig.printWidth as number) ?? 100
		});

		return formattedContent;
	} catch (error) {
		console.log(
			`ℹ️  Prettier formatting failed for ${filePath}, writing file without formatting:`,
			error
		);
		return content;
	}
}

/**
 * Build final file content
 */
function buildFileContent(
	parsedContent: { imports: string[]; customCode: string[] },
	requiredImports: string[],
	generatedCode: string,
	loadFunctionConfig: LoadFunctionConfig
): string {
	const { imports, customCode } = parsedContent;

	// Merge and filter imports
	const allImports = [...new Set([...imports, ...requiredImports])];
	const filteredImports = allImports.filter(
		(importLine) => !importLine.includes('_getTranslations')
	);

	// Clean up custom code
	const cleanCustomCode = customCode
		.join('\n')
		.replace(/\n\s*\n\s*\n/g, '\n\n')
		.trim();

	// Build content
	let finalContent = filteredImports.join('\n');
	finalContent += '\n' + generatedCode;

	if (cleanCustomCode) {
		finalContent += '\n\n' + cleanCustomCode;
	}

	// Add load function
	const loadFunction = createLoadFunction(loadFunctionConfig);
	finalContent += '\n\n' + loadFunction;

	return finalContent;
}

/**
 * Helper function to modify existing load function to add _loadedTranslations
 */
export function modifyLoadFunction(loadFunctionCode: string): string {
	const hasLoadedTranslations = loadFunctionCode.includes('_loadedTranslations');

	if (hasLoadedTranslations) {
		return loadFunctionCode.replace(
			/_loadedTranslations:\s*_getTranslations\(\)/g,
			'_loadedTranslations: _getTranslations(_translationKeys)'
		);
	}

	const lines = loadFunctionCode.split('\n');
	const functionSignature = lines.find((line) => line.includes('export const load'));
	const existingContent = extractReturnContent(loadFunctionCode);

	return `${functionSignature}
	return {
		${existingContent ? `${existingContent},\n\t\t` : ''}_loadedTranslations: _getTranslations(_translationKeys)
	};
}`;
}

/**
 * Simple function to inject _loadedTranslations into an existing load function
 */
function injectLoadedTranslations(loadFunctionCode: string): string {
	// Check if _loadedTranslations already exists
	if (loadFunctionCode.includes('_loadedTranslations')) {
		return loadFunctionCode;
	}

	// Find the return statement and inject _loadedTranslations
	// Use a more specific regex that matches only actual return statements
	// This regex matches both single-line and multi-line return statements
	const returnRegex = /^(\s*)return\s*\{([\s\S]*?)\}(\s*;?)(\s*)$/gm;
	const modifiedCode = loadFunctionCode.replace(
		returnRegex,
		(match, indent, returnContent, semicolon, trailing) => {
			// Split the return content into lines to handle multi-line objects
			const lines = returnContent.split('\n');
			const lastLine = lines[lines.length - 1];
			const trimmedLastLine = lastLine.trim();

			// Check if the last line ends with a comma
			const hasComma = trimmedLastLine.endsWith(',');

			// Add _loadedTranslations to the last line
			const newLastLine = hasComma
				? `${lastLine} _loadedTranslations: _getTranslations(_translationKeys)`
				: `${lastLine}, _loadedTranslations: _getTranslations(_translationKeys)`;

			// Reconstruct the return content
			lines[lines.length - 1] = newLastLine;
			const newReturnContent = lines.join('\n');

			return `${indent}return { ${newReturnContent} }${semicolon}${trailing}`;
		}
	);

	return modifiedCode;
}

/**
 * Inject translation keys into load function with support for nested routes and accumulated keys
 */
export function injectTranslationKeys(
	serverFilePath: string,
	usedKeys: Set<string>,
	routePath: string,
	defaultPath: string,
	verbose: boolean = false
): void {
	if (verbose) {
		console.log(`🔧 injectTranslationKeys called for: ${serverFilePath}`);
	}

	const keysArray = Array.from(usedKeys);
	const isLayoutFile = serverFilePath.includes('+layout.server.ts');
	const loadType = isLayoutFile ? 'LayoutServerLoad' : 'PageServerLoad';
	const requiredImports = [`import type { ${loadType} } from './$types.js';`];
	const generatedCode = generateTranslationsCode(keysArray);

	let finalContent: string;

	if (existsSync(serverFilePath)) {
		if (verbose) {
			console.log(`📁 File exists: ${serverFilePath}`);
		}

		const existingContent = readFileSync(serverFilePath, 'utf8');

		// Check if load function already exists
		if (existingContent.includes('export const load')) {
			// Add imports and generated code if not already present
			let newContent = existingContent;

			// Add imports if not present
			if (!newContent.includes('_getTranslations')) {
				const importIndex = newContent.lastIndexOf('import');
				const insertIndex = newContent.indexOf('\n', importIndex) + 1;
				newContent =
					newContent.slice(0, insertIndex) + generatedCode + '\n' + newContent.slice(insertIndex);
			}

			// Add type import if not present
			if (!newContent.includes(loadType)) {
				const importIndex = newContent.lastIndexOf('import');
				const insertIndex = newContent.indexOf('\n', importIndex) + 1;
				newContent =
					newContent.slice(0, insertIndex) +
					requiredImports.join('\n') +
					'\n' +
					newContent.slice(insertIndex);
			}

			// Inject _loadedTranslations into existing load function
			newContent = injectLoadedTranslations(newContent);

			finalContent = newContent;
		} else {
			// Create new load function
			const loadFunctionConfig: LoadFunctionConfig = {
				loadType,
				existingReturnContent: ''
			};

			finalContent = buildFileContent(
				{ imports: [], customCode: [] },
				requiredImports,
				generatedCode,
				loadFunctionConfig
			);
		}
	} else {
		// Create new file
		const loadFunctionConfig: LoadFunctionConfig = {
			loadType,
			existingReturnContent: ''
		};

		finalContent =
			requiredImports.join('\n') +
			'\n' +
			generatedCode +
			'\n\n' +
			createLoadFunction(loadFunctionConfig);
	}

	// Check if content has actually changed before writing
	if (!hasContentChanged(serverFilePath, finalContent)) {
		if (verbose) {
			const fileType = isLayoutFile ? '+layout.server.ts' : '+page.server.ts';
			console.log(`⏭️  Skipping ${fileType} for route ${routePath} - no changes detected`);
		}
		return;
	}

	// Write file with formatting
	formatFile(serverFilePath, finalContent)
		.then((formattedContent) => {
			writeFileSync(serverFilePath, formattedContent, 'utf8');
		})
		.catch((error) => {
			console.warn(`⚠️  Failed to format ${serverFilePath}:`, error);
			writeFileSync(serverFilePath, finalContent, 'utf8');
		});

	if (verbose) {
		const fileType = isLayoutFile ? '+layout.server.ts' : '+page.server.ts';
		const action = existsSync(serverFilePath) ? 'Updated' : 'Created';
		console.log(
			`✅ ${action} ${fileType} for route ${routePath} with ${keysArray.length} translation keys`
		);
	}
}
