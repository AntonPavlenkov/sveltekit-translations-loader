#!/usr/bin/env node

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

/**
 * Fix library imports in the dist directory
 * This script ensures that internal imports use relative paths instead of package names
 */

function fixImportsInFile(filePath) {
	try {
		let content = readFileSync(filePath, 'utf8');
		let modified = false;

		// Fix imports from the package name to relative paths
		// Replace imports like 'sveltekit-translations-loader' with relative paths
		const importRegex = /import\s+.*\s+from\s+['"]sveltekit-translations-loader['"]/g;
		const matches = content.match(importRegex);

		if (matches) {
			modified = true;
			// For now, we'll replace with the actual relative path
			// This is a simplified version - you might need to adjust based on your structure
			content = content.replace(importRegex, (match) => {
				// Replace with appropriate relative path based on context
				return match.replace('sveltekit-translations-loader', './index');
			});
		}

		if (modified) {
			writeFileSync(filePath, content, 'utf8');
			console.log(`✅ Fixed imports in ${filePath}`);
		}
	} catch (error) {
		console.warn(`⚠️  Could not process ${filePath}:`, error.message);
	}
}

function processDirectory(dirPath) {
	try {
		const items = readdirSync(dirPath);

		for (const item of items) {
			const fullPath = join(dirPath, item);
			const stat = statSync(fullPath);

			if (stat.isDirectory()) {
				processDirectory(fullPath);
			} else if (extname(item) === '.js' || extname(item) === '.d.ts') {
				fixImportsInFile(fullPath);
			}
		}
	} catch (error) {
		console.warn(`⚠️  Could not process directory ${dirPath}:`, error.message);
	}
}

// Start processing from the dist directory
const distPath = join(process.cwd(), 'dist');
if (statSync(distPath).isDirectory()) {
	console.log('🔧 Fixing library imports in dist directory...');
	processDirectory(distPath);
	console.log('✅ Library import fixes completed');
} else {
	console.log('⚠️  dist directory not found, skipping import fixes');
}
