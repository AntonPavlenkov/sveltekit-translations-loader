import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Helper function to modify existing load function to add _loadedTranslations
 */
export function modifyLoadFunction(loadFunctionCode: string): string {
	// Check if _loadedTranslations already exists
	const hasLoadedTranslations = loadFunctionCode.includes('_loadedTranslations');

	if (hasLoadedTranslations) {
		// Update existing _loadedTranslations to use _translationKeys parameter
		return loadFunctionCode.replace(
			/_loadedTranslations:\s*_getTranslations\(\)/g,
			'_loadedTranslations: _getTranslations(_translationKeys)'
		);
	}

	// Extract the function signature
	const lines = loadFunctionCode.split('\n');
	const functionSignature = lines.find((line) => line.includes('export const load'));

	// Extract existing return content by parsing the return statement
	const returnMatch = loadFunctionCode.match(/return\s*\{([^}]*)\}/);
	let existingContent = '';

	if (returnMatch) {
		// Clean up the content by removing commas and extra whitespace
		existingContent = returnMatch[1]
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.map((line) => line.replace(/,$/, '')) // Remove trailing commas
			.join(', ');
	}

	// Build new load function
	let newFunction = functionSignature + '\n';
	newFunction += '\treturn {\n';

	if (existingContent) {
		newFunction += `\t\t${existingContent},\n`;
	}

	newFunction += '\t\t_loadedTranslations: _getTranslations(_translationKeys)\n';
	newFunction += '\t};\n';
	newFunction += '}';

	return newFunction;
}

/**
 * Generate the auto-generated code block with proper import path
 */
function generateTranslationsCode(keysArray: string[]): string {
	return `// =============================================================================
// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN
import { _getTranslations } from 'sveltekit-translations-loader';
const _translationKeys: string[] = [${keysArray.map((key) => `'${key}'`).join(', ')}];
// END AUTO-GENERATED CODE
// =============================================================================
`;
}

/**
 * Format a file using Prettier (optional)
 */
async function formatFile(filePath: string, content: string): Promise<string> {
	try {
		// Check if Prettier is available
		const prettier = await import('prettier').catch(() => null);
		if (!prettier) {
			console.log('ℹ️  Prettier not available, writing file without formatting');
			return content;
		}

		// Try to resolve Prettier config from the project root
		let prettierConfig: Record<string, unknown> = {};
		try {
			const configPath = resolve(process.cwd(), '.prettierrc');
			if (existsSync(configPath)) {
				const configContent = readFileSync(configPath, 'utf8');
				prettierConfig = JSON.parse(configContent);
			}
		} catch {
			// If config reading fails, use defaults
			console.log('ℹ️  Could not read Prettier config, using defaults');
		}

		// Try to format the content using Prettier with project config
		const formattedContent = await prettier.format(content, {
			filepath: filePath,
			parser: 'typescript',
			...prettierConfig, // Use project config if available
			// Fallback defaults if no config
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
		// Return original content if formatting fails
		return content;
	}
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

	// Required imports for the plugin
	const requiredImports = [`import type { ${loadType} } from './$types.js';`];

	// Generate the auto-generated code block
	const generatedCode = generateTranslationsCode(keysArray);

	// Check if file exists and read existing content
	let finalContent = '';
	if (existsSync(serverFilePath)) {
		if (verbose) {
			console.log(`📁 File exists: ${serverFilePath}`);
		}
		const existingContent = readFileSync(serverFilePath, 'utf8');

		// Parse existing content to extract imports and custom code
		const lines = existingContent.split('\n');
		const importLines: string[] = [];
		const codeLines: string[] = [];
		let inLoadFunction = false;
		let braceCount = 0;
		let hasLoadFunction = false;
		let loadFunctionStart = -1;
		let loadFunctionEnd = -1;
		let inAutoGenerated = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Check if we're entering or leaving auto-generated section
			if (
				line.includes(
					'// ============================================================================='
				) ||
				line.includes('// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN') ||
				line.includes('// END AUTO-GENERATED CODE')
			) {
				inAutoGenerated = true;
				continue;
			}

			// Skip auto-generated content
			if (inAutoGenerated) {
				// Check if we've reached the end of auto-generated section
				if (line.trim() === '' || (!line.includes('//') && line.trim() !== '')) {
					inAutoGenerated = false;
				} else {
					continue;
				}
			}

			// Skip any auto-generated content
			if (
				line.includes('const _translationKeys') ||
				line.includes('// Auto-injected translation keys') ||
				line.includes('import { _getTranslations }') ||
				(line.trim().startsWith("'") && line.trim().endsWith("',")) ||
				(line.trim().startsWith("'") && line.trim().endsWith("'")) ||
				line.trim() === '];' ||
				line.trim() === ']' ||
				line.includes('eslint-disable-next-line') ||
				line.includes('@typescript-eslint/no-explicit-any') ||
				line.includes('keyof typeof import') ||
				line.includes('> = [') ||
				line.includes('> = [')
			) {
				continue;
			}

			// Check if this line starts a load function (both with and without type annotation)
			if (
				(line.includes('export const load:') || line.includes('export const load =')) &&
				!inLoadFunction
			) {
				hasLoadFunction = true;
				loadFunctionStart = i;
				inLoadFunction = true;
				braceCount = 0;
			}

			if (inLoadFunction) {
				// Count braces to find the end of the load function
				braceCount += (line.match(/\{/g) || []).length;
				braceCount -= (line.match(/\}/g) || []).length;

				if (braceCount === 0 && line.trim() !== '') {
					loadFunctionEnd = i;
					inLoadFunction = false;
				}
			} else {
				// Check if this is an import statement
				if (line.trim().startsWith('import ')) {
					importLines.push(line);
				} else if (line.trim() !== '') {
					codeLines.push(line);
				}
			}
		}

		// Add required imports if they don't exist
		const allImports = [...new Set([...importLines, ...requiredImports])];

		// Remove duplicate _getTranslations imports (they're auto-generated)
		const filteredImports = allImports.filter((importLine) => {
			if (importLine.includes('_getTranslations')) {
				return false; // Remove _getTranslations imports as they're auto-generated
			}
			return true;
		});

		// Build final content - clean up empty lines
		const cleanImports = filteredImports.join('\n');
		const cleanExistingCode = codeLines
			.join('\n')
			.replace(/\n\s*\n\s*\n/g, '\n\n')
			.trim();

		finalContent = cleanImports;

		// Add auto-generated code right after imports
		finalContent += '\n' + generatedCode;

		if (cleanExistingCode) {
			finalContent += '\n\n' + cleanExistingCode;
		}

		if (hasLoadFunction) {
			// Extract existing return content from the load function
			const loadLines = lines.slice(loadFunctionStart, loadFunctionEnd + 1);
			const loadFunctionCode = loadLines.join('\n');
			const returnMatch = loadFunctionCode.match(/return\s*\{([^}]*)\}/);

			let existingReturnContent = '';
			if (returnMatch) {
				existingReturnContent = returnMatch[1]
					.split('\n')
					.map((line) => line.trim())
					.filter((line) => line.length > 0 && !line.includes('_loadedTranslations'))
					.map((line) => line.replace(/,$/, ''))
					.join(', ');
			}

			// Create new load function with existing content and _loadedTranslations
			const newLoadFunction = `export const load: ${loadType} = async () => {
	return {
		${existingReturnContent ? `${existingReturnContent},\n\t\t` : ''}_loadedTranslations: _getTranslations(_translationKeys)
	};
}`;

			finalContent += '\n\n' + newLoadFunction;
		} else {
			// Create new load function
			const newLoadFunction = `export const load: ${loadType} = async () => {
	return {
		_loadedTranslations: _getTranslations(_translationKeys)
	};
}`;
			finalContent += '\n\n' + newLoadFunction;
		}
	} else {
		// Create new file with imports, generated code, and load function
		const newLoadFunction = `export const load: ${loadType} = async () => {
	return {
		_loadedTranslations: _getTranslations(_translationKeys)
	};
}`;

		finalContent = requiredImports.join('\n') + '\n' + generatedCode + '\n\n' + newLoadFunction;
	}

	// Format the file using Prettier (optional) and write to file
	formatFile(serverFilePath, finalContent)
		.then((formattedContent) => {
			writeFileSync(serverFilePath, formattedContent, 'utf8');
		})
		.catch((error) => {
			console.warn(`⚠️  Failed to format ${serverFilePath}:`, error);
			// Fallback: write unformatted content
			writeFileSync(serverFilePath, finalContent, 'utf8');
		});

	if (verbose) {
		console.log(
			`✅ ${existsSync(serverFilePath) ? 'Updated' : 'Created'} ${isLayoutFile ? '+layout.server.ts' : '+page.server.ts'} for route ${routePath} with ${keysArray.length} translation keys`
		);
	}
}
