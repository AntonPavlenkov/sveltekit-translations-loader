# SvelteKit Translations Loader

[![NPM Version](https://img.shields.io/npm/v/sveltekit-translations-loader)](https://www.npmjs.com/package/sveltekit-translations-loader)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-5.0+-orange.svg)](https://kit.svelte.dev/)

A powerful, intelligent translation system for SvelteKit with automatic type generation, runtime injection, tree-shaking, and build-time optimizations. Designed for maximum performance and developer experience.

## ✨ Key Features

### 🚀 **Smart Translation Management**

- **Automatic Type Generation**: TypeScript types generated from your translation files
- **Intelligent Tree-shaking**: Only loads translation keys that are actually used
- **Auto-scanning**: Detects translation usage in components and auto-injects into load functions
- **Recursive Component Scanning**: Scans imported components for comprehensive key detection

### ⚡ **Build-Time Optimization**

- **Production Optimization**: Removes function call overhead in production builds
- **Bundle Size Reduction**: Eliminates translation function imports during build
- **Direct Data Access**: Transforms to direct `page.data` access for maximum performance
- **Development-Friendly**: Keeps clean function syntax during development

### 🛡️ **Developer Experience**

- **Full Type Safety**: Complete TypeScript support with generated types
- **Hot Reload**: Automatic reloading during development
- **Zero Configuration**: Works out of the box with sensible defaults
- **Vite Integration**: Seamless integration with SvelteKit's build process

### 🌐 **Internationalization**

- **Multiple Locale Support**: Built-in support for multiple languages
- **Parameter Interpolation**: Smart handling of translation parameters
- **Nested Route Inheritance**: Automatic translation inheritance in nested routes
- **Runtime Locale Switching**: Dynamic language switching

## 📦 Installation

```bash
npm install sveltekit-translations-loader
```

## 🚀 Quick Start

### 1. Create Your Default Translations

```typescript
// src/types/default-translations.ts
const defaultTranslations = {
	hello: 'Hello (default)',
	goodbye: 'Goodbye (default)',
	welcome: 'Welcome, {{name}}!',
	'user-count': 'There {{count}} users online',
	'nested-params': 'Hello {{name}}, you have {{count}} messages',
	layoutTitle: 'My App Layout',
	pageContent: 'This is the page content'
} as const;

export default defaultTranslations;
```

### 2. Configure the Vite Plugin

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { sveltekitTranslationsImporterPlugin } from 'sveltekit-translations-loader/plugin';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/types/default-translations.ts',
			runtimePath: 'src/types/translations/messages/index.ts',
			verbose: false, // Set to true for detailed logging
			removeFunctionsOnBuild: true // Enable production optimization
		})
	]
});
```

### 3. Set Up Server Hooks

```typescript
// src/hooks.server.ts
import { TranslationsManager } from 'sveltekit-translations-loader/server';
import type { Handle } from '@sveltejs/kit';

const translationsManager = new TranslationsManager({
	defaultLocale: 'en-US',
	supportedLocales: ['en-US', 'de-DE', 'es-ES', 'fr-FR']
});

export const handle: Handle = async ({ event, resolve }) => {
	// Initialize translations manager
	await translationsManager.initialize();

	// Detect locale from cookies, headers, or URL
	const locale = event.cookies.get('locale') || 'en-US';

	// Set up translations context
	event.locals.translationsManager = translationsManager;
	event.locals.locale = locale;

	return resolve(event);
};
```

### 4. Use in Your Components

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
	import * as t from '@i18n';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<div>
	<h1>{t.hello()}</h1>
	<p>{t.welcome('Alice')}</p>
	<p>{t.userCount(42)}</p>
	<p>{t.nestedParams({ name: 'Bob', count: 5 })}</p>
</div>
```

## ⚙️ Configuration

### Plugin Options

```typescript
interface PluginConfig {
	/** Path to your default translations file */
	defaultPath: string;

	/** Path where generated runtime files will be stored */
	runtimePath: string;

	/** Enable detailed logging during build */
	verbose?: boolean;

	/**
	 * Enable production build optimization
	 * Removes @i18n imports and uses direct page.data access
	 * Only active during 'npm run build'
	 */
	removeFunctionsOnBuild?: boolean;
}
```

### TranslationsManager Options

```typescript
interface TranslationsManagerConfig {
	/** Default locale to use */
	defaultLocale: string;

	/** Array of supported locales */
	supportedLocales: string[];

	/** Optional custom translation loader */
	translationLoader?: (locale: string) => Promise<Record<string, string>>;
}
```

## 🔄 Development vs Production Behavior

### Development Mode (`npm run dev`)

```svelte
<script lang="ts">
	import * as t from '@i18n';
</script>

<p>{t.hello()}</p><p>{t.welcome('User')}</p><p>{t.userCount(42)}</p>
```

**Benefits:**

- Clean, readable function calls
- Easy debugging and development
- Hot reload support
- Type safety and IntelliSense

### Production Mode (`npm run build`)

When `removeFunctionsOnBuild: true` is enabled, the build process automatically transforms your components:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { r } from '$lib/helpers';
</script>

<p>{page.data._loadedTranslations['hello']}</p>
<p>{r(page.data._loadedTranslations['welcome'], { name: 'User' })}</p>
<p>{r(page.data._loadedTranslations['user-count'], { count: 42 })}</p>
```

**Benefits:**

- Zero function call overhead
- Smaller bundle size
- Direct data access for maximum performance
- Automatic parameter handling

## 🌳 Tree-Shaking & Auto-Injection

The plugin automatically scans your components and generates load functions with only the translations you actually use:

```typescript
// src/routes/+page.server.ts (auto-generated)
import { injectTranslations } from 'sveltekit-translations-loader/server';

export const load = async ({ locals }) => {
	const { translationsManager, locale } = locals;

	// Only keys actually used in components
	const translationKeys = ['hello', 'welcome', 'user-count'];

	return {
		...(await injectTranslations(translationsManager, locale, translationKeys))
	};
};
```

## 🌐 Internationalization

### Multiple Languages

```typescript
// src/types/translations/
// ├── en-US.ts
// ├── de-DE.ts
// ├── es-ES.ts
// └── fr-FR.ts

// de-DE.ts
export default {
	hello: 'Hallo',
	welcome: 'Willkommen, {{name}}!',
	'user-count': 'Es gibt {{count}} Benutzer online'
};
```

### Runtime Language Switching

```svelte
<script lang="ts">
	async function switchLanguage(locale: string) {
		await fetch('/api/language', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ locale })
		});
		window.location.reload();
	}
</script>

<select onchange={(e) => switchLanguage(e.target.value)}>
	<option value="en-US">🇺🇸 English</option>
	<option value="de-DE">🇩🇪 Deutsch</option>
	<option value="es-ES">🇪🇸 Español</option>
	<option value="fr-FR">🇫🇷 Français</option>
</select>
```

## 📊 Performance Benefits

### Bundle Size Reduction

| Feature            | Development       | Production |
| ------------------ | ----------------- | ---------- |
| Function Imports   | ✅ Included       | ❌ Removed |
| Direct Data Access | ❌ No             | ✅ Yes     |
| Parameter Wrapping | ❌ Function calls | ✅ Inline  |
| Type Safety        | ✅ Full           | ✅ Full    |

### Runtime Performance

- **Zero Function Call Overhead**: Direct property access in production
- **Smaller JavaScript Bundles**: Elimination of translation function imports
- **Optimized Parameter Handling**: Automatic parameter object creation
- **Tree-Shaking**: Only used translation keys are included

## 🔧 Advanced Usage

### Custom Parameter Types

```typescript
// Single parameter (auto-wrapped)
t.welcome('Alice');
// Transforms to: r(translations['welcome'], { name: 'Alice' })

// Multiple parameters (object)
t.nestedParams({ name: 'Bob', count: 5 });
// Transforms to: r(translations['nested-params'], { name: 'Bob', count: 5 })
```

### Nested Route Inheritance

```typescript
// Parent layout translations are inherited by child routes
// src/routes/+layout.server.ts → ['layoutTitle', 'navigation']
// src/routes/dashboard/+page.server.ts → ['pageTitle', 'content']
// Result: Child has access to all parent + own translations
```

### Custom Translation Loading

```typescript
const manager = new TranslationsManager({
	defaultLocale: 'en-US',
	supportedLocales: ['en-US', 'custom'],
	translationLoader: async (locale) => {
		// Custom loading logic
		const translations = await fetchFromAPI(locale);
		return translations;
	}
});
```

## 📋 API Reference

### Client-Side Exports

```typescript
// From '@i18n'
import * as t from '@i18n';

// Individual translation functions (auto-generated)
t.hello(): string
t.welcome(name: string): string
t.userCount(count: number): string
t.nestedParams(params: { name: string; count: number }): string
```

### Helper Functions

```typescript
// From '$lib/helpers'
import { getTData, r } from '$lib/helpers';

// Get current translation data
const translations = getTData();

// Parameter replacement function
const result = r('Hello {{name}}', { name: 'World' });
```

### Server-Side Exports

```typescript
// From 'sveltekit-translations-loader/server'
import { TranslationsManager, injectTranslations } from 'sveltekit-translations-loader/server';

// Translation manager for server-side operations
const manager = new TranslationsManager(config);

// Inject translations into load functions
await injectTranslations(manager, locale, keys);
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- SvelteKit 2.0+
- TypeScript (recommended)

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/sveltekit-translations-loader.git

# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm run test:unit

# Type checking
npm run check
```

### Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

## 📝 Changelog

### Latest Features

- ✨ **Build-Time Optimization**: New `removeFunctionsOnBuild` option for production performance
- 🔧 **Automatic Import Management**: Smart import handling for development vs production
- 📦 **Bundle Size Optimization**: Significant reduction in JavaScript bundle size
- 🎯 **Direct Data Access**: Zero-overhead translation access in production

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Support

- 📖 **Documentation**: [GitHub Repository](https://github.com/AntonPavlenkov/sveltekit-translations-loader)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/AntonPavlenkov/sveltekit-translations-loader/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/AntonPavlenkov/sveltekit-translations-loader/discussions)
- ⭐ **Star on GitHub**: If you find this project useful!

---

**Made with ❤️ for the SvelteKit community**
