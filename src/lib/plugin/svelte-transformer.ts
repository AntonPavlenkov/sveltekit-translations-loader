import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { queueFileWrite } from './batch-file-writer.js';
import { requiresSafeAccess, sanitizeFunctionName } from './helpers';

// Constants
const PARAMETER_REGEX = /{{([^}]+)}}/g;

const IMPORT_PATTERNS = {
	PAGE: "import { page } from '$app/state'",
	R_FUNCTION: 'import { r }',
	I18N_SINGLE: "import * as t from '@i18n'",
	I18N_DOUBLE: 'import * as t from "@i18n"',
	HELPERS: /import\s*{([^}]+)}\s*from\s*['"][$]lib\/helpers['"];?/,
	PAGE_IMPORT: /import\s*{\s*page\s*}\s*from\s*['"][$]app\/state['"];?/,
	SCRIPT_TAG: /<script[^>]*>/
} as const;

const IGNORED_DIRECTORIES = ['.svelte-kit', 'node_modules'] as const;

// Types
interface TranslationCall {
	fullMatch: string;
	functionName: string;
	key: string;
	params?: string;
	hasParams: boolean;
}

interface ImportState {
	hasPageImport: boolean;
	hasRImport: boolean;
}

/**
 * Transform compiled JavaScript bundle code to remove @i18n imports
 * This works on the final bundled output, not Svelte source code
 */
export function transformCompiledBundle(
	code: string,
	defaultTranslations: Record<string, string>,
	verbose: boolean = false
): string {
	// This is a simplified version that just removes @i18n imports from compiled bundles
	// In a real implementation, you'd need more sophisticated transformation
	// For now, let's just return the original code to avoid breaking the bundle
	if (verbose) {
		console.log('📦 Bundle transformation skipped (feature needs more development)');
	}
	return code;
}

/**
 * Check if content has specific imports
 */
function checkImportState(content: string): ImportState {
	return {
		hasPageImport: content.includes(IMPORT_PATTERNS.PAGE),
		hasRImport: content.includes(IMPORT_PATTERNS.R_FUNCTION)
	};
}

/**
 * Extract parameters from translation value
 */
function extractParameters(value: string): string[] {
	const params = new Set<string>();
	let match;

	while ((match = PARAMETER_REGEX.exec(value)) !== null) {
		params.add(match[1].trim());
	}

	return Array.from(params);
}

/**
 * Generate parameter code for translation call
 */
function generateParameterCode(params: string, translationValue: string): string {
	const extractedParams = extractParameters(translationValue);

	if (extractedParams.length === 1) {
		// Single parameter: wrap in object with parameter name
		const paramName = extractedParams[0];
		return `{ ${paramName}: ${params} }`;
	}

	return params;
}

/**
 * Generate replacement code for translation call
 */
function generateReplacementCode(
	call: TranslationCall,
	defaultTranslations: Record<string, string>
): string {
	if (call.hasParams) {
		const paramsCode = generateParameterCode(call.params!, defaultTranslations[call.key]);
		return `r(page.data._loadedTranslations['${call.key}'], ${paramsCode})`;
	} else {
		return `page.data._loadedTranslations['${call.key}']`;
	}
}

/**
 * Replace translation calls in content
 */
function replaceTranslationCalls(
	content: string,
	translationCalls: TranslationCall[],
	defaultTranslations: Record<string, string>
): { transformedContent: string; needsRFunction: boolean } {
	let transformedContent = content;
	let needsRFunction = false;

	for (const call of translationCalls) {
		if (call.hasParams) {
			needsRFunction = true;
		}

		const replacementCode = generateReplacementCode(call, defaultTranslations);
		transformedContent = transformedContent.replace(call.fullMatch, replacementCode);
	}

	return { transformedContent, needsRFunction };
}

/**
 * Find all translation function calls in the content
 */
function findTranslationCalls(
	content: string,
	defaultTranslations: Record<string, string>
): TranslationCall[] {
	const calls: TranslationCall[] = [];

	for (const [key, value] of Object.entries(defaultTranslations)) {
		const functionName = sanitizeFunctionName(key);
		const hasPlaceholders = value.includes('{{');
		const isReserved = requiresSafeAccess(key);

		// Create regex patterns for both dot notation and bracket notation
		const patterns = [];

		if (isReserved) {
			// For reserved words, prefer bracket notation
			patterns.push({
				dotNotation: `t\\.${functionName}`,
				bracketNotation: `t\\[['"]${key}['"]\\]`
			});
		} else {
			// For safe words, use dot notation
			patterns.push({
				dotNotation: `t\\.${functionName}`,
				bracketNotation: `t\\[['"]${key}['"]\\]`
			});
		}

		patterns.forEach(({ dotNotation, bracketNotation }) => {
			if (hasPlaceholders) {
				// Look for calls with parameters
				[dotNotation, bracketNotation].forEach((pattern) => {
					const paramRegex = new RegExp(`${pattern}\\s*\\(([^)]+)\\)`, 'g');
					let match;
					while ((match = paramRegex.exec(content)) !== null) {
						calls.push({
							fullMatch: match[0],
							functionName,
							key,
							params: match[1].trim(),
							hasParams: true
						});
					}
				});
			} else {
				// Look for calls without parameters
				[dotNotation, bracketNotation].forEach((pattern) => {
					const noParamRegex = new RegExp(`${pattern}\\s*\\(\\s*\\)`, 'g');
					let match;
					while ((match = noParamRegex.exec(content)) !== null) {
						calls.push({
							fullMatch: match[0],
							functionName,
							key,
							hasParams: false
						});
					}
				});
			}
		});
	}

	return calls;
}

/**
 * Add page import to the script section
 */
function addPageImport(content: string): string {
	const scriptMatch = content.match(IMPORT_PATTERNS.SCRIPT_TAG);
	if (scriptMatch) {
		const insertIndex = scriptMatch.index! + scriptMatch[0].length;
		const importStatement = "\n\timport { page } from '$app/state';";
		return content.slice(0, insertIndex) + importStatement + content.slice(insertIndex);
	}
	return content;
}

/**
 * Add r function import to the script section
 */
function addRImport(content: string): string {
	// Check if there's already a helpers import we can extend
	const helpersImportMatch = content.match(IMPORT_PATTERNS.HELPERS);

	if (helpersImportMatch) {
		// Extend existing import
		const existingImports = helpersImportMatch[1].trim();
		const newImports = existingImports.includes('r') ? existingImports : `${existingImports}, r`;
		return content.replace(helpersImportMatch[0], `import { ${newImports} } from '$lib/helpers';`);
	} else {
		// Add new import after page import if it exists
		const pageImportMatch = content.match(IMPORT_PATTERNS.PAGE_IMPORT);
		if (pageImportMatch) {
			const insertIndex = pageImportMatch.index! + pageImportMatch[0].length;
			const importStatement = "\n\timport { r } from '$lib/helpers';";
			return content.slice(0, insertIndex) + importStatement + content.slice(insertIndex);
		} else {
			// Add new import at beginning of script
			const scriptMatch = content.match(IMPORT_PATTERNS.SCRIPT_TAG);
			if (scriptMatch) {
				const insertIndex = scriptMatch.index! + scriptMatch[0].length;
				const importStatement = "\n\timport { r } from '$lib/helpers';";
				return content.slice(0, insertIndex) + importStatement + content.slice(insertIndex);
			}
		}
	}

	return content;
}

/**
 * Remove @i18n import from the file
 */
function removeI18nImport(content: string): string {
	// Remove the import line and any trailing newlines
	return content
		.replace(/\s*import\s*\*\s*as\s*t\s*from\s*['"]@i18n['"];?\s*\n?/g, '')
		.replace(/\s*import\s*\*\s*as\s*t\s*from\s*["']@i18n["'];?\s*\n?/g, '');
}

/**
 * Apply all transformations to content
 */
function applyTransformations(
	content: string,
	translationCalls: TranslationCall[],
	importState: ImportState,
	needsRFunction: boolean
): string {
	let transformedContent = content;

	// Add necessary imports if we made replacements
	if (translationCalls.length > 0) {
		// Add page import if not present
		if (!importState.hasPageImport) {
			transformedContent = addPageImport(transformedContent);
		}

		// Add r function import if needed and not present
		if (needsRFunction && !importState.hasRImport) {
			transformedContent = addRImport(transformedContent);
		}

		// Remove @i18n import
		transformedContent = removeI18nImport(transformedContent);
	}

	return transformedContent;
}

/**
 * Transform Svelte content to remove @i18n imports and use direct page data access
 * This version works with string content instead of files (for use in transform hooks)
 */
export function transformSvelteContent(
	content: string,
	defaultTranslations: Record<string, string>,
	verbose: boolean = false
): string {
	// Check import state
	const importState = checkImportState(content);

	// Find all translation function calls
	const translationCalls = findTranslationCalls(content, defaultTranslations);

	// Replace translation calls
	const { transformedContent, needsRFunction } = replaceTranslationCalls(
		content,
		translationCalls,
		defaultTranslations
	);

	// Apply all transformations
	const finalContent = applyTransformations(
		transformedContent,
		translationCalls,
		importState,
		needsRFunction
	);

	if (verbose && translationCalls.length > 0) {
		console.log(`🔄 Applied ${translationCalls.length} translation replacements`);
	}

	return finalContent;
}

/**
 * Check if file has i18n imports
 */
function hasI18nImports(content: string): boolean {
	return (
		content.includes(IMPORT_PATTERNS.I18N_SINGLE) || content.includes(IMPORT_PATTERNS.I18N_DOUBLE)
	);
}

/**
 * Recursively find all .svelte files in a directory
 */
async function findSvelteFiles(dir: string): Promise<string[]> {
	const files: string[] = [];

	try {
		const entries = await readdir(dir);

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stats = await stat(fullPath);

			if (stats.isDirectory()) {
				// Skip ignored directories
				if (
					!entry.startsWith('.') &&
					!IGNORED_DIRECTORIES.includes(entry as (typeof IGNORED_DIRECTORIES)[number])
				) {
					files.push(...(await findSvelteFiles(fullPath)));
				}
			} else if (entry.endsWith('.svelte')) {
				files.push(fullPath);
			}
		}
	} catch (error) {
		console.error('❌ Error finding .svelte files:', error);
		// Ignore directories we can't read
	}

	return files;
}

/**
 * Find all .svelte files that import from '@i18n'
 */
async function findSvelteFilesWithI18nImports(): Promise<string[]> {
	const files = await findSvelteFiles(resolve('src'));
	const filesWithI18n: string[] = [];

	for (const file of files) {
		const content = await readFile(file, 'utf-8');
		if (hasI18nImports(content)) {
			filesWithI18n.push(file);
		}
	}

	return filesWithI18n;
}

/**
 * Transform a single Svelte file
 */
async function transformSvelteFile(
	filePath: string,
	defaultTranslations: Record<string, string>,
	verbose: boolean
): Promise<void> {
	const content = await readFile(filePath, 'utf-8');
	const transformedContent = transformSvelteContent(content, defaultTranslations, verbose);

	// Only write if content changed
	if (transformedContent !== content) {
		queueFileWrite(filePath, transformedContent);

		if (verbose) {
			const translationCalls = findTranslationCalls(content, defaultTranslations);
			console.log(
				`🔄 Transformed ${filePath.replace(process.cwd(), '.')} (${translationCalls.length} replacements)`
			);
		}
	}
}

/**
 * Transform Svelte files to remove @i18n imports and use direct page data access
 * @deprecated Use transformSvelteContent instead for build-time transformations
 */
export async function transformSvelteFiles(
	verbose: boolean = false,
	defaultTranslations: Record<string, string>
): Promise<void> {
	try {
		// Find all .svelte files that import from '@i18n'
		const svelteFiles = await findSvelteFilesWithI18nImports();

		if (verbose) {
			console.log(`🔄 Found ${svelteFiles.length} .svelte files using @i18n imports`);
		}

		for (const filePath of svelteFiles) {
			await transformSvelteFile(filePath, defaultTranslations, verbose);
		}

		if (verbose && svelteFiles.length > 0) {
			console.log('✅ Successfully transformed .svelte files to use direct page data access');
		}
	} catch (error) {
		if (verbose) {
			console.error('❌ Error transforming .svelte files:', error);
		}
	}
}
