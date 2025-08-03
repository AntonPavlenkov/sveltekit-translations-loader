# SvelteKit Translations Loader

A powerful translation system for SvelteKit with automatic type generation and runtime injection. Built on top of Paraglide.js for optimal performance and developer experience.

## Features

- 🚀 **Automatic Type Generation**: Generate TypeScript types from your translation files
- 🔧 **Vite Plugin**: Seamless integration with SvelteKit's build process
- 🎯 **Runtime Injection**: Inject translations at runtime with full type safety
- 📦 **Zero Bundle Size**: Leverages Paraglide.js for optimal performance
- 🔄 **Hot Reload**: Automatic reloading during development
- 🛡️ **Type Safety**: Full TypeScript support with generated types

## Installation

```bash
npm install sveltekit-translations-loader
```

## Quick Start

### 1. Set up your translation files

Create your translation files in a structured format:

```typescript
// src/types/translations/messages/hello.ts
export default {
  en: "Hello",
  es: "Hola",
  fr: "Bonjour"
};
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
      translationsDir: 'src/types/translations',
      outputDir: 'src/types/generated'
    })
  ]
});
```

### 3. Use in your SvelteKit app

```svelte
<script lang="ts">
  import { t } from '@inlang/paraglide-js';
</script>

<h1>{t('hello')}</h1>
```

## API Reference

### Plugin Configuration

```typescript
interface PluginConfig {
  translationsDir: string;        // Directory containing translation files
  outputDir: string;             // Directory for generated types
  defaultLocale?: string;        // Default locale (default: 'en')
  supportedLocales?: string[];   // Supported locales
  watchMode?: boolean;           // Enable watch mode for development
}
```

### Core Exports

#### `sveltekitTranslationsImporterPlugin`
The main Vite plugin for processing translation files.

#### `TranslationsManager`
Class for managing translations at runtime.

```typescript
import { TranslationsManager } from 'sveltekit-translations-loader';

const manager = new TranslationsManager({
  defaultLocale: 'en',
  supportedLocales: ['en', 'es', 'fr']
});
```

#### `_getTranslations`
Function for injecting translations into SvelteKit load functions.

```typescript
import { _getTranslations } from 'sveltekit-translations-loader';

export const load = async ({ params }) => {
  const translations = _getTranslations(params.lang);
  return { translations };
};
```

#### `getTData` and `r`
Utility functions for translation data handling.

```typescript
import { getTData, r } from 'sveltekit-translations-loader';

const tData = getTData('hello');
const result = r(tData, 'en');
```

## Advanced Usage

### Custom Translation Structure

You can customize the translation file structure:

```typescript
// Custom structure example
export default {
  messages: {
    en: "Hello",
    es: "Hola"
  },
  metadata: {
    description: "Greeting message"
  }
};
```

### Runtime Language Switching

```typescript
import { TranslationsManager } from 'sveltekit-translations-loader';

const manager = new TranslationsManager();
manager.setLocale('es'); // Switch to Spanish
```

### Type-Safe Translation Keys

The plugin generates TypeScript types for your translation keys:

```typescript
// Generated types
type TranslationKeys = 'hello' | 'goodbye' | 'welcome';

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
