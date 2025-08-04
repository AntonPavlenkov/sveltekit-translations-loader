import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { sanitizeFunctionName } from './helpers.js';

/**
 * Transform Svelte files to remove @i18n imports and use direct page data access
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

/**
 * Find all .svelte files that import from '@i18n'
 */
async function findSvelteFilesWithI18nImports(): Promise<string[]> {
	const files = await findSvelteFiles(resolve('src'));
	const filesWithI18n: string[] = [];

	for (const file of files) {
		const content = await readFile(file, 'utf-8');
		if (
			content.includes("import * as t from '@i18n'") ||
			content.includes('import * as t from "@i18n"')
		) {
			filesWithI18n.push(file);
		}
	}

	return filesWithI18n;
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
				// Skip node_modules and .svelte-kit directories
				if (!entry.startsWith('.') && entry !== 'node_modules') {
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
 * Transform a single Svelte file
 */
async function transformSvelteFile(
	filePath: string,
	defaultTranslations: Record<string, string>,
	verbose: boolean
): Promise<void> {
	const content = await readFile(filePath, 'utf-8');
	let transformedContent = content;

	// Check if file already has page import
	const hasPageImport = content.includes("import { page } from '$app/state'");
	const hasRImport = content.includes('import { r }');

	// Find all translation function calls (t.functionName() or t.functionName(params))
	const translationCalls = findTranslationCalls(content, defaultTranslations);
	let needsRFunction = false;

	// Replace translation calls
	for (const call of translationCalls) {
		if (call.hasParams) {
			needsRFunction = true;
			// For single parameters, check if they need to be wrapped in an object
			let paramsCode = call.params!;
			const value = defaultTranslations[call.key];

			// Extract parameter names from the translation string
			const paramRegex = /{{([^}]+)}}/g;
			const params = new Set<string>();
			let match;
			while ((match = paramRegex.exec(value)) !== null) {
				params.add(match[1].trim());
			}

			if (params.size === 1) {
				// Single parameter: wrap in object with parameter name
				const paramName = Array.from(params)[0];
				paramsCode = `{ ${paramName}: ${call.params} }`;
			}

			// Replace with r() function call
			transformedContent = transformedContent.replace(
				call.fullMatch,
				`r(page.data._loadedTranslations['${call.key}'], ${paramsCode})`
			);
		} else {
			// Replace with direct page data access
			transformedContent = transformedContent.replace(
				call.fullMatch,
				`page.data._loadedTranslations['${call.key}']`
			);
		}
	}

	// Add necessary imports if we made replacements
	if (translationCalls.length > 0) {
		// Add page import if not present
		if (!hasPageImport) {
			transformedContent = addPageImport(transformedContent);
		}

		// Add r function import if needed and not present
		if (needsRFunction && !hasRImport) {
			transformedContent = addRImport(transformedContent);
		}

		// Remove @i18n import
		transformedContent = removeI18nImport(transformedContent);

		// Write the transformed file
		await writeFile(filePath, transformedContent);

		if (verbose) {
			console.log(
				`🔄 Transformed ${filePath.replace(process.cwd(), '.')} (${translationCalls.length} replacements)`
			);
		}
	}
}

/**
 * Find all translation function calls in the content
 */
function findTranslationCalls(
	content: string,
	defaultTranslations: Record<string, string>
): Array<{
	fullMatch: string;
	functionName: string;
	key: string;
	params?: string;
	hasParams: boolean;
}> {
	const calls: Array<{
		fullMatch: string;
		functionName: string;
		key: string;
		params?: string;
		hasParams: boolean;
	}> = [];

	// Create regex patterns for each translation function
	for (const [key, value] of Object.entries(defaultTranslations)) {
		const functionName = sanitizeFunctionName(key);
		const hasPlaceholders = typeof value === 'string' && value.includes('{{');

		if (hasPlaceholders) {
			// Look for calls with parameters: t.functionName(params)
			const paramRegex = new RegExp(`t\\.${functionName}\\s*\\(([^)]+)\\)`, 'g');
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
		} else {
			// Look for calls without parameters: t.functionName()
			const noParamRegex = new RegExp(`t\\.${functionName}\\s*\\(\\s*\\)`, 'g');
			let match;
			while ((match = noParamRegex.exec(content)) !== null) {
				calls.push({
					fullMatch: match[0],
					functionName,
					key,
					hasParams: false
				});
			}
		}
	}

	return calls;
}

/**
 * Add page import to the script section
 */
function addPageImport(content: string): string {
	// Find the script tag
	const scriptMatch = content.match(/<script[^>]*>/);
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
	const helpersImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"][$]lib\/helpers['"];?/);

	if (helpersImportMatch) {
		// Extend existing import
		const existingImports = helpersImportMatch[1].trim();
		const newImports = existingImports.includes('r') ? existingImports : `${existingImports}, r`;
		return content.replace(helpersImportMatch[0], `import { ${newImports} } from '$lib/helpers';`);
	} else {
		// Add new import after page import if it exists
		const pageImportMatch = content.match(/import\s*{\s*page\s*}\s*from\s*['"][$]app\/state['"];?/);
		if (pageImportMatch) {
			const insertIndex = pageImportMatch.index! + pageImportMatch[0].length;
			const importStatement = "\n\timport { r } from '$lib/helpers';";
			return content.slice(0, insertIndex) + importStatement + content.slice(insertIndex);
		} else {
			// Add new import at beginning of script
			const scriptMatch = content.match(/<script[^>]*>/);
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
