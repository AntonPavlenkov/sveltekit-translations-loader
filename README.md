# SvelteKit Translations Loader

A powerful translation system for SvelteKit with automatic type generation, runtime injection, and intelligent tree-shaking. Built on top of Paraglide.js for optimal performance and developer experience.

## Features

- 🚀 **Automatic Type Generation**: Generate TypeScript types from your translation files
- 🔧 **Vite Plugin**: Seamless integration with SvelteKit's build process
- 🎯 **Runtime Injection**: Inject translations at runtime with full type safety
- 📦 **Zero Bundle Size**: Leverages Paraglide.js for optimal performance
- 🔄 **Hot Reload**: Automatic reloading during development
- 🛡️ **Type Safety**: Full TypeScript support with generated types
- 🌳 **Intelligent Tree-shaking**: Only loads translation keys that are actually used
- 🔍 **Auto-scanning**: Automatically detects translation usage in components and injects keys into load functions
- 🏗️ **Virtual Module System**: Clean import interface with `@sveltekit-translations-loader`

## Installation

```bash
npm install sveltekit-translations-loader
```

## Quick Start

### 1. Set up your default translations file

Create your default translations file:

```typescript
// src/types/default-translations.ts
const defaultTranslations = {
	hello: 'Hello (default)',
	goodbye: 'Goodbye (default)',
	welcome: 'Welcome, {{name}}!',
	'user-count': 'There {{count}} users online',
	'nested-params': 'Hello {{name}}, you have {{count}} messages',
	hey: 'Hey {{name}}',
	zap: 'Zap',
	layoutTitle: 'Nested Layout Title',
	layoutDescription: 'This is a layout description that will be inherited by child routes',
	pageTitle: 'Nested Page Title',
	pageContent: 'This page content demonstrates nested route translation inheritance'
} as const;

export default defaultTranslations;
```

### 2. Configure the Vite plugin

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { sveltekitTranslationsImporterPlugin } from 'sveltekit-translations-loader/plugin';

export default defineConfig({
	plugins: [
		sveltekit(),
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/types/default-translations.ts',
			runtimePath: 'src/lib/runtime',
			verbose: true // Enable detailed logging
		})
	]
});
```

### 3. Set up server hooks

```typescript
// src/hooks.server.ts
import { TranslationsManager } from 'sveltekit-translations-loader/server';

const translationsManager = new TranslationsManager({
	defaultLocale: 'en',
	supportedLocales: ['en', 'es', 'fr']
});

export const handle = async ({ event, resolve }) => {
	// Set up translations manager and locale
	event.locals.translationsManager = translationsManager;
	event.locals.locale = 'en'; // Or detect from request

	return resolve(event);
};
```

### 4. Use in your SvelteKit components

```svelte
<script lang="ts">
	import * as t from '@sveltekit-translations-loader';
</script>

<h1>{t.hello()}</h1><p>{t.welcome('Alice')}</p>
```

## How It Works

### 1. Virtual Module System

The plugin creates a virtual module `@sveltekit-translations-loader` that provides type-safe translation functions:

```typescript
// Generated automatically from your translation files
import * as t from '@sveltekit-translations-loader';

// Simple translations
t.hello(); // Returns "Hello"

// Parameterized translations
t.welcome('John'); // Returns "Welcome, John!"
t.userCount(42); // Returns "42 users online"
```

### 2. Auto-injection of Translation Keys

The plugin automatically scans your Svelte components and injects only the used translation keys into your load functions:

```typescript
// src/routes/+page.server.ts (auto-generated)
import { _getTranslations } from 'sveltekit-translations-loader/server';
const _translationKeys: string[] = ['hello', 'welcome', 'user-count'];

export const load = async () => {
	return {
		_loadedTranslations: _getTranslations(_translationKeys)
	};
};
```

### 3. Recursive Component Scanning

The plugin scans all imported components and accumulates translation keys for nested routes:

```svelte
<!-- src/routes/nested-example/+page.svelte -->
<script lang="ts">
	import * as t from '@sveltekit-translations-loader';
	import NestedComponent from './NestedComponent.svelte';
</script>

<h1>{t.pageTitle()}</h1>
<NestedComponent />
```

```svelte
<!-- src/routes/nested-example/NestedComponent.svelte -->
<script lang="ts">
	import * as t from '@sveltekit-translations-loader';
</script>

<p>{t.nestedContent()}</p>
```

The plugin will automatically include both `pageTitle` and `nestedContent` keys in the load function.

## API Reference

### Plugin Configuration

```typescript
interface PluginConfig {
	defaultPath: string; // Path to your default translations file
	runtimePath: string; // Path where generated runtime files will be stored
	verbose?: boolean; // Enable detailed logging
}
```

### Core Exports

#### `sveltekitTranslationsImporterPlugin`

The main Vite plugin for processing translation files and auto-injecting keys.

#### `TranslationsManager` (Server-side)

Class for managing translations at runtime.

```typescript
import { TranslationsManager } from 'sveltekit-translations-loader/server';

const manager = new TranslationsManager({
	defaultLocale: 'en',
	supportedLocales: ['en', 'es', 'fr']
});
```

#### `_getTranslations` (Server-side)

Function for injecting translations into SvelteKit load functions.

```typescript
import { _getTranslations } from 'sveltekit-translations-loader/server';

export const load = async ({ params }) => {
	const translations = _getTranslations(['hello', 'welcome']);
	return { translations };
};
```

#### `getTData` and `r` (Client-side)

Utility functions for translation data handling.

```typescript
import { getTData, r } from 'sveltekit-translations-loader';

const tData = getTData();
const result = r('Hello {{name}}', { name: 'World' });
```

## Advanced Usage

### Parameter Support

Translation functions automatically handle parameters:

```typescript
// Single parameter
t.welcome('Alice'); // "Welcome, Alice!"

// Multiple parameters
t.nestedParams({ name: 'Bob', count: 5 }); // "Hello Bob, you have 5 items"
```

### Nested Route Inheritance

Translations from parent routes are automatically available in child routes:

```typescript
// src/routes/+layout.server.ts
const _translationKeys: string[] = ['layoutTitle', 'layoutDescription'];

// src/routes/nested/+page.server.ts
const _translationKeys: string[] = ['pageTitle', 'pageContent'];
// Will have access to both layout and page translations
```

### Custom Translation Structure

You can customize the translation file structure:

```typescript
// Custom structure example
export default {
	messages: {
		en: 'Hello',
		es: 'Hola'
	},
	metadata: {
		description: 'Greeting message'
	}
};
```

### Type-Safe Translation Keys

The plugin generates TypeScript types for your translation keys:

```typescript
// Generated types
type TranslationKeys = 'hello' | 'welcome' | 'goodbye';

// Usage with full type safety
const message: TranslationKeys = 'hello'; // ✅ Valid
const invalid: TranslationKeys = 'invalid'; // ❌ Type error
```

## Development

### Building the Library

```bash
npm run build
```

### Running Tests

```bash
npm run test:unit
```

### Type Checking

```bash
npm run check
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- 📖 [Documentation](https://github.com/yourusername/sveltekit-translations-loader#readme)
- 🐛 [Issues](https://github.com/yourusername/sveltekit-translations-loader/issues)
- 💬 [Discussions](https://github.com/yourusername/sveltekit-translations-loader/discussions)
