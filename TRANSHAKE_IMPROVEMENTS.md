# Transhake Plugin Improvements

This document outlines the improvements made to the transhake plugin based on your proposals.

## Key Improvements

### 1. Simple TypeScript Files (.ts instead of .svelte.ts)

The plugin now generates simple `.ts` files instead of `.svelte.ts` files for better tree-shaking and cleaner imports:

```typescript
// Before: hello.svelte.ts
// After: hello.ts

// Generated files:
// - utils.ts (shared utilities)
// - hello.ts (individual translation function)
// - index.ts (re-exports all functions)
// - index.d.ts (TypeScript declarations)
```

### 2. Nested Route Translation Key Inheritance

The plugin now properly handles nested routes by extending translation keys instead of overriding them:

```typescript
// Route structure:
// /nested-example/
//   ├── +layout.svelte (uses: layoutTitle, layoutDescription)
//   └── +page.svelte (uses: pageTitle, pageContent)

// Generated server files will include ALL keys from parent layouts:
// +layout.server.ts: layoutTitle, layoutDescription
// +page.server.ts: layoutTitle, layoutDescription, pageTitle, pageContent
```

### 3. Extra Translation Keys via Locals

You can now add dynamic translation keys that weren't auto-detected by the plugin:

```typescript
// In hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
	// Add extra translation keys for dynamic content
	event.locals.transhakeExtraKeys = {
		'dynamic-welcome': `Welcome to ${event.url.pathname}`,
		'user-specific': 'Custom user message',
		'api-generated-key': 'Value from API or database'
	};

	return resolve(event);
};
```

## Usage Examples

### Basic Usage

```svelte
<script lang="ts">
	import { t } from '@transhake';
</script>

<h1>{t.hello()}</h1><p>{t.welcome({ name: 'John' })}</p>
```

### Nested Routes

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { t } from '@transhake';
</script>

<header>
  <h1>{t.layoutTitle()}</h1>
</header>

<slot />

<!-- +page.svelte -->
<script lang="ts">
  import { t } from '@transhake';
</script>

<h2>{t.pageTitle()}</h2>
<!-- This page has access to both layoutTitle and pageTitle -->
```

### Dynamic Keys

```typescript
// In your load function or hooks
export const load: PageServerLoad = async ({ locals }) => {
	// The plugin automatically merges auto-detected keys with extra keys
	// from locals.transhakeExtraKeys
	return {
		// transhake will include both auto-detected and extra keys
	};
};
```

## Generated Code Structure

### Server Files

```typescript
// Auto-generated +page.server.ts
import type { PageServerLoad } from './$types.js';
import { translationsManager } from '$lib/server/translations-manager.js';

function getTranshakeTranslations(locale: string, extraKeys?: Record<string, string>) {
	const allTranslations = translationsManager.getTranslations(locale);

	const baseTranslations = {
		hello: allTranslations['hello'] || 'hello (missing)',
		welcome: allTranslations['welcome'] || 'welcome (missing)'
	};

	// Merge with extra keys from locals if provided
	return extraKeys ? { ...baseTranslations, ...extraKeys } : baseTranslations;
}

export const load: PageServerLoad = async ({ locals }) => {
	const locale = locals.locale || 'en-US';

	return {
		transhake: getTranshakeTranslations(locale, locals.transhakeExtraKeys)
	};
};
```

### Client Files

```typescript
// Generated utils.ts
import { page } from '$app/state';

export const getTranshakeData = () => page.data.transhake;

// Generated hello.ts
import { getTranshakeData } from './utils.js';

export const hello = (): string => {
	return getTranshakeData()['hello'];
};

// Generated index.ts
export { hello } from './hello.js';
export { welcome } from './welcome.js';
```

## Benefits

1. **Better Tree-shaking**: Individual `.ts` files allow bundlers to only include used translations
2. **Nested Route Support**: Layout translations are properly inherited by child routes
3. **Dynamic Content**: Support for runtime-generated translation keys
4. **Type Safety**: Full TypeScript support with generated declarations
5. **Performance**: Only loads translation keys that are actually used

## Migration Notes

- Existing `.svelte.ts` files will be replaced with `.ts` files
- The plugin automatically handles the migration
- No changes needed in your Svelte components
- The `@transhake` import path remains the same
