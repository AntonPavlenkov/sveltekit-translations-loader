import { existsSync, readFileSync } from 'fs';

/**
 * Create a simple hash from a string
 */
export function createHash(content: string): string {
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return hash.toString();
}

/**
 * Check if file content has actually changed
 */
export function hasContentChanged(filePath: string, newContent: string): boolean {
	if (!existsSync(filePath)) {
		return true; // File doesn't exist, so it's a change
	}

	try {
		const existingContent = readFileSync(filePath, 'utf8');

		// Simple string comparison - no filtering needed since we prevent writes when Console Ninja is detected
		return existingContent !== newContent;
	} catch {
		// If we can't read the existing file, assume it changed
		return true;
	}
}

/**
 * Detect if Console Ninja code is present in the content
 */
export function hasConsoleNinjaCode(content: string): boolean {
	// Check for various Console Ninja patterns
	const consoleNinjaPatterns = [
		/oo_[a-zA-Z_][a-zA-Z0-9_]*/, // Console Ninja function names
		/\/\* istanbul ignore next \*\/.*function.*oo_/, // Function definitions
		/globalThis\._console_ninja/, // Global references
		/console-ninja/, // Direct references
		/\(0,\s*eval\)\(/, // Eval statements
		/\/\* c8 ignore start \*\//, // Coverage ignore comments
		/_console_ninja_session/ // Session variables
	];

	return consoleNinjaPatterns.some((pattern) => pattern.test(content));
}

/**
 * Read file content safely with error logging
 */
export function readFileContent(filePath: string, logErrors = true): string | null {
	try {
		return readFileSync(filePath, 'utf8');
	} catch (error) {
		if (logErrors) {
			console.error(`❌ Error reading ${filePath}:`, error);
		}
		return null;
	}
}

/**
 * Read file content safely without error logging (for dependency tracking)
 */
export function readFileContentSilent(filePath: string): string | null {
	return readFileContent(filePath, false);
}

// Common import patterns that can be shared
export const COMMON_IMPORT_PATTERNS = {
	STATIC: [
		/import\s+(\w+)\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import Component from './Component.svelte'
		/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+\.svelte)['"]/g, // import { Component } from './Component.svelte'
		/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+\.svelte)['"]/g // import * as Components from './Component.svelte'
	],
	DYNAMIC: [
		/import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // import('Component.svelte')
		/await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // await import('Component.svelte')
		/const\s+\w+\s*=\s*await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // const c = await import('Component.svelte')
		/let\s+\w+\s*=\s*await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // let c = await import('Component.svelte')
		/var\s+\w+\s*=\s*await\s+import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g, // var c = await import('Component.svelte')
		/=\s*import\s*\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g // = import('Component.svelte')
	],
	I18N: [
		/import\s+\*\s+as\s+\w+\s+from\s+['"]@i18n['"]/g,
		/import\s+\{\s*[^}]*\s*\}\s+from\s+['"]@i18n['"]/g,
		/import\s+\w+\s+from\s+['"]@i18n['"]/g
	]
} as const;
