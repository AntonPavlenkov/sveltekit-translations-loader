#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CLIOptions {
	defaultPath?: string;
	verbose?: boolean;
	autoGitignore?: boolean;
	consoleNinjaProtection?: boolean;
}

/**
 * Load configuration from package.json or use defaults
 */
function loadConfig(): CLIOptions {
	const packageJsonPath = resolve('package.json');

	if (existsSync(packageJsonPath)) {
		try {
			const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
			const config = packageJson['sveltekit-translations-loader'] || {};

			return {
				defaultPath: config.defaultPath || 'src/types/default-translations.ts',
				verbose: config.verbose ?? false,
				autoGitignore: config.autoGitignore ?? true,
				consoleNinjaProtection: config.consoleNinjaProtection ?? true
			};
		} catch {
			console.warn('⚠️  Could not parse package.json, using default configuration');
		}
	}

	return {
		defaultPath: 'src/types/default-translations.ts',
		verbose: false,
		autoGitignore: true,
		consoleNinjaProtection: true
	};
}

/**
 * Parse command line arguments
 */
function parseArgs(): { command: string; options: CLIOptions } {
	const args = process.argv.slice(2);
	const command = args[0];

	// Load base config
	const config = loadConfig();

	// Override with CLI arguments
	const options: CLIOptions = { ...config };

	// Check for help and version flags first
	for (const arg of args) {
		if (arg === '--help' || arg === '-h') {
			showHelp();
			process.exit(0);
		} else if (arg === '--version') {
			showVersion();
			process.exit(0);
		}
	}

	// Process other options
	for (let i = 1; i < args.length; i++) {
		const arg = args[i];

		if (arg === '--verbose' || arg === '-v') {
			options.verbose = true;
		} else if (arg === '--no-auto-gitignore') {
			options.autoGitignore = false;
		} else if (arg === '--no-console-ninja-protection') {
			options.consoleNinjaProtection = false;
		} else if (arg.startsWith('--default-path=')) {
			options.defaultPath = arg.split('=')[1];
		}
	}

	return { command, options };
}

/**
 * Show help information
 */
function showHelp(): void {
	console.log(`
sveltekit-translations-loader CLI

Usage:
  npx sveltekit-translations-loader --generate [options]

Commands:
  --generate    Generate translation files and inject keys into load functions

Options:
  --verbose, -v                    Enable verbose output
  --no-auto-gitignore             Disable automatic .gitignore updates
  --no-console-ninja-protection   Disable Console Ninja protection
  --default-path=<path>           Set custom default translations path
  --help, -h                      Show this help message
  --version                       Show version information

Configuration:
  You can configure the plugin in your package.json:
  
  {
    "sveltekit-translations-loader": {
      "defaultPath": "src/types/default-translations.ts",
      "verbose": false,
      "autoGitignore": true,
      "consoleNinjaProtection": true
    }
  }

Examples:
  npx sveltekit-translations-loader --generate
  npx sveltekit-translations-loader --generate --verbose
  npx sveltekit-translations-loader --generate --default-path=src/i18n/translations.ts

Important Notes:
  • Make sure you're running this command from your SvelteKit project root directory
  • The default path should be relative to your project root
  • If you get "file not found" errors, check your current working directory
  • Use --verbose for detailed debugging information
`);
}

/**
 * Show version information
 */
function showVersion(): void {
	const packageJsonPath = resolve(__dirname, '../package.json');

	if (existsSync(packageJsonPath)) {
		try {
			const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
			console.log(`sveltekit-translations-loader v${packageJson.version}`);
		} catch {
			console.log('sveltekit-translations-loader (version unknown)');
		}
	} else {
		console.log('sveltekit-translations-loader (version unknown)');
	}
}

/**
 * Execute the generate command
 */
async function executeGenerate(options: CLIOptions): Promise<void> {
	const { defaultPath, verbose, autoGitignore, consoleNinjaProtection } = options;

	if (verbose) {
		console.log('🚀 Starting translation generation...');
		console.log(`📁 Default path: ${defaultPath}`);
		console.log(`🔧 Auto gitignore: ${autoGitignore}`);
		console.log(`🛡️  Console Ninja protection: ${consoleNinjaProtection}`);
	}

	// Check if we're in a SvelteKit project
	const svelteConfigPath = resolve('svelte.config.js');
	const packageJsonPath = resolve('package.json');

	if (!existsSync(svelteConfigPath) && !existsSync(packageJsonPath)) {
		console.error(`❌ This doesn't appear to be a SvelteKit project directory`);
		console.error(`💡 Make sure you're running this command from your SvelteKit project root`);
		console.error(`💡 Current working directory: ${process.cwd()}`);
		console.error(`💡 Expected to find svelte.config.js or package.json in this directory`);
		process.exit(1);
	}

	// Load configuration files to get aliases
	const viteConfig: Record<string, unknown> = {};
	const svelteKitConfig: Record<string, unknown> = {};

	try {
		// Load Vite config
		if (existsSync('vite.config.ts')) {
			const viteConfigContent = readFileSync('vite.config.ts', 'utf8');
			// Simple regex to extract alias configuration
			const aliasMatch = viteConfigContent.match(/alias:\s*({[^}]+})/);
			if (aliasMatch) {
				try {
					// Convert the alias object string to actual object
					const aliasStr = aliasMatch[1].replace(/'/g, '"').replace(/`/g, '"');
					viteConfig.alias = JSON.parse(aliasStr);
				} catch {
					if (verbose) {
						console.log('⚠️  Could not parse Vite aliases from vite.config.ts');
					}
				}
			}
		}

		// Load SvelteKit config
		if (existsSync(svelteConfigPath)) {
			const svelteConfigContent = readFileSync(svelteConfigPath, 'utf8');
			// Simple regex to extract kit.alias configuration
			const kitAliasMatch = svelteConfigContent.match(/kit:\s*{[^}]*alias:\s*({[^}]+})/);
			if (kitAliasMatch) {
				try {
					// Convert the alias object string to actual object
					const aliasStr = kitAliasMatch[1].replace(/'/g, '"').replace(/`/g, '"');
					svelteKitConfig.kit = { alias: JSON.parse(aliasStr) };
				} catch {
					if (verbose) {
						console.log('⚠️  Could not parse SvelteKit aliases from svelte.config.js');
					}
				}
			}
		}

		if (verbose) {
			console.log('🔧 Loaded Vite config:', viteConfig);
			console.log('🔧 Loaded SvelteKit config:', svelteKitConfig);
		}
	} catch (error) {
		if (verbose) {
			console.log('⚠️  Error loading configuration files:', error);
		}
	}

	// Check if default path exists
	const resolvedDefaultPath = resolve(defaultPath!);

	// Always show path information for debugging
	console.log(`🔍 Path debugging information:`);
	console.log(`   Current working directory: ${process.cwd()}`);
	console.log(`   Input default path: ${defaultPath}`);
	console.log(`   Resolved absolute path: ${resolvedDefaultPath}`);
	console.log(`   File exists: ${existsSync(resolvedDefaultPath) ? '✅ Yes' : '❌ No'}`);

	if (!existsSync(resolvedDefaultPath)) {
		console.error(`❌ Default translations file not found: ${resolvedDefaultPath}`);
		console.error(`💡 Make sure the file exists and the path is correct`);
		console.error(`💡 Current working directory: ${process.cwd()}`);
		console.error(`💡 Try using an absolute path or check if you're in the right directory`);
		console.error(`💡 Common solutions:`);
		console.error(`   • Run from your SvelteKit project root directory`);
		console.error(`   • Use --default-path=./src/types/default-translations.ts`);
		console.error(`   • Check if the file exists at the specified path`);
		process.exit(1);
	}

	if (verbose) {
		console.log(`📁 Resolved default path: ${resolvedDefaultPath}`);
	}

	try {
		// Create a mock plugin state for CLI execution
		const mockState = {
			isBuildMode: false,
			isDevelopment: false,
			defaultTranslations: {},
			processingTimeout: null,
			lastProcessedFiles: new Set<string>(),
			translationsHash: '',
			viteConfig: {
				command: 'build',
				mode: 'production',
				alias: viteConfig.alias as
					| Record<string, string>
					| Array<{ find: string | RegExp; replacement: string }>
					| undefined,
				resolve: {
					alias: viteConfig.alias as
						| Record<string, string>
						| Array<{ find: string | RegExp; replacement: string }>
						| undefined
				}
			}
		};

		// Dynamically import the processing function to avoid bundling issues
		// Try to import from the published package structure first
		let pluginModule;
		try {
			// For published package
			if (verbose) {
				console.log('🔍 Attempting to import from published package...');
			}
			pluginModule = await import('sveltekit-translations-loader/plugin');
			if (verbose) {
				console.log('✅ Successfully imported from published package');
				console.log('🔍 Available exports:', Object.keys(pluginModule));
			}
		} catch (error) {
			if (verbose) {
				console.log(
					'⚠️  Failed to import from published package:',
					error instanceof Error ? error.message : 'Unknown error'
				);
				console.log('🔍 Attempting local development import...');
			}
			try {
				// For local development
				pluginModule = await import('./lib/plugin/index.js');
				if (verbose) {
					console.log('✅ Successfully imported from local development path');
				}
			} catch (localError) {
				throw new Error(
					`Failed to import plugin module from both published package and local path. Published package error: ${error instanceof Error ? error.message : 'Unknown error'}. Local path error: ${localError instanceof Error ? localError.message : 'Unknown error'}`
				);
			}
		}

		// Set the plugin configurations for alias resolution
		if (pluginModule.setPluginConfigs) {
			pluginModule.setPluginConfigs(mockState.viteConfig, svelteKitConfig);
		}

		// Execute the generation process
		await pluginModule.processTranslations(
			mockState,
			defaultPath!,
			verbose ?? false,
			autoGitignore ?? true,
			consoleNinjaProtection ?? true,
			true // Force usage rescan
		);

		if (verbose) {
			console.log('✅ Translation generation completed successfully!');
		} else {
			console.log('✅ Translations generated successfully');
		}
	} catch (error) {
		console.error('❌ Error during translation generation:', error);
		if (verbose) {
			console.error('Full error details:', error);
		}
		process.exit(1);
	}
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
	const { command, options } = parseArgs();

	if (!command) {
		console.error('❌ No command specified');
		showHelp();
		process.exit(1);
	}

	switch (command) {
		case '--generate':
			await executeGenerate(options);
			break;
		default:
			console.error(`❌ Unknown command: ${command}`);
			showHelp();
			process.exit(1);
	}
}

// Run the CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('❌ CLI execution failed:', error);
		process.exit(1);
	});
}
