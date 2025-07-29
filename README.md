# 🌐 SvelteKit Translations Importer

A tree-shakable, TypeScript-first translations library for Svelte 5 with Vite plugin support.

## ✨ Features

- **🌳 Fully Tree-shakable**: Import only the translation functions you use
- **⚡ Vite Plugin**: Automatic code generation with hot module replacement
- **🎯 TypeScript First**: Full type safety and intellisense support
- **🔧 Parameter Interpolation**: Dynamic value replacement with `{{key}}` syntax
- **🏗️ Build-time Generation**: Zero runtime overhead
- **📦 Multiple Import Patterns**: Use default export or individual imports
- **🔄 Automatic Key Conversion**: Kebab-case keys become camelCase functions

## 🚀 Quick Start

### Installation

```bash
npm install sveltekit-translations-loader
```

### Setup

1. **Configure your Vite plugin** in `vite.config.ts`:

```typescript
import { sveltekitTranslationsImporterPlugin } from 'sveltekit-translations-loader';

export default defineConfig({
	plugins: [
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/lib/default-translations.ts',
			runtimePath: 'src/lib/transhake/tGetter.ts'
		})
	]
});
```

2. **Create your default translations** in `src/lib/default-translations.ts`:

```typescript
const defaultTranslations = {
	hello: 'Hello (default)',
	goodbye: 'Goodbye (default)',
	welcome: 'Welcome, {{name}}!',
	'user-count': 'There are {{count}} users online',
	'nested-params': 'Hello {{name}}, you have {{count}} messages'
} as const;

export default defaultTranslations;
```

3. **Use in your Svelte components**:

```svelte
<script lang="ts">
	import * as t from '@sveltekit-translations-loader';
	// or import { hello, welcome } from '@sveltekit-translations-loader';
</script>

<h1>{t.hello()}</h1><p>{t.welcome({ name: 'Anton' })}</p><p>{t.userCount({ count: 42 })}</p>
```

## 📖 Usage Examples

### Basic Translation

```typescript
// Translation key: "hello"
t.hello(); // "Hello (default)"
```

### Parameter Interpolation

```typescript
// Translation key: "welcome" with value "Welcome, {{name}}!"
t.welcome({ name: 'John' }); // "Welcome, John!"

// Multiple parameters
t.nestedParams({ name: 'Alice', count: 5 });
// "Hello Alice, you have 5 messages"
```

### Tree-shakable Imports

```typescript
// Import only what you need
import { hello, welcome } from '@sveltekit-translations-loader';

// Only these functions will be included in your bundle
console.log(hello());
console.log(welcome({ name: 'Developer' }));
```

### Kebab-case Key Conversion

```typescript
// Translation key: "user-count" becomes function userCount()
t.userCount({ count: 100 }); // "There are 100 users online"
```

## 🔧 API Reference

### Plugin Options

```typescript
interface SvelteKitTranslationsImporterPluginOptions {
	defaultPath: string; // Path to your default translations file
	runtimePath: string; // Where to generate the runtime functions
}
```

### Translation Function Signature

```typescript
function translationKey(params?: Record<string, string | number>): string;
```

- **params**: Optional object with key-value pairs for parameter interpolation
- **Returns**: Translated string with interpolated values

### Parameter Interpolation

Use `{{key}}` syntax in your translation strings:

```typescript
'Hello {{name}}, you have {{count}} messages';
```

Parameters are replaced at runtime:

```typescript
t.message({ name: 'John', count: 3 });
// "Hello John, you have 3 messages"
```

## 🏗️ How It Works

1. **Build Time**: The Vite plugin reads your default translations
2. **Code Generation**: Individual functions are generated for each translation key
3. **Tree Shaking**: Bundlers can eliminate unused translation functions
4. **Runtime**: Zero overhead - just direct function calls

## 🎯 Benefits

### Traditional i18n Libraries

```typescript
// Everything bundled, even unused translations
import i18n from 'some-i18n-lib';
i18n.t('hello'); // Runtime key lookup
```

### SvelteKit Translations Importer

```typescript
// Only imported functions bundled
import { hello } from '@sveltekit-translations-loader';
hello(); // Direct function call
```

## 🔄 Development Workflow

1. **Add translation keys** to your default translations file
2. **Vite plugin automatically regenerates** functions on file changes
3. **Import and use** the new functions in your components
4. **TypeScript provides full intellisense** for available functions

## 📦 Output Example

Your translations file:

```typescript
{
  hello: 'Hello (default)',
  'user-count': 'There are {{count}} users'
}
```

Generated functions:

```typescript
export function hello(params?: Record<string, string | number>): string {
	return 'Hello (default)';
}

export function userCount(params?: Record<string, string | number>): string {
	let result = 'There are {{count}} users';
	if (params?.count) {
		result = result.replace(/\{\{\s*count\s*\}\}/g, String(params.count));
	}
	return result;
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.
