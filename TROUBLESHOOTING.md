# SvelteKit Translations Loader - Troubleshooting Guide

## Issue: Plugin not updating server files when saving .svelte files

### Common Causes and Solutions

#### 1. Development Server Not Running

**Problem**: The file watcher only works when the Vite development server is running.

**Solution**:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

#### 2. Plugin Not Properly Configured

**Problem**: The plugin is not correctly set up in `vite.config.ts`.

**Solution**: Ensure your `vite.config.ts` looks like this:

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { sveltekitTranslationsImporterPlugin } from 'sveltekit-translations-loader';

export default defineConfig({
	plugins: [
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/types/default-translations.ts',
			runtimePath: 'src/types/translations/messages/index.ts',
			verbose: true, // Enable for debugging
			removeFunctionsOnBuild: true
		}),
		sveltekit()
	]
});
```

#### 3. File Structure Issues

**Problem**: The plugin expects specific file structure.

**Solution**: Ensure your project has:

- `src/routes/` directory for SvelteKit routes
- Translation files in the specified paths
- `.svelte` files with proper `@i18n` imports

#### 4. Import Issues

**Problem**: The `.svelte` file doesn't have the correct import.

**Solution**: Ensure your `.svelte` files import translations correctly:

```svelte
<script lang="ts">
	import * as t from '@i18n';
	// or
	import { t } from '@i18n';
</script>

{t.hello()}
```

#### 5. Debounce Delay

**Problem**: The plugin has a 100ms debounce delay which might seem like it's not working.

**Solution**: Wait a moment after saving, or reduce the debounce delay in the plugin code.

#### 6. Verbose Mode for Debugging

**Problem**: You can't see what's happening.

**Solution**: Enable verbose mode in your `vite.config.ts`:

```typescript
sveltekitTranslationsImporterPlugin({
	defaultPath: 'src/types/default-translations.ts',
	runtimePath: 'src/types/translations/messages/index.ts',
	verbose: true, // This will show detailed logs
	removeFunctionsOnBuild: true
});
```

### Testing the Plugin

1. **Create a test page**:

```svelte
<!-- src/routes/test/+page.svelte -->
<script lang="ts">
	import * as t from '@i18n';
	let { data } = $props();
</script>

<h1>Test</h1><p>{t.hello()}</p>
```

2. **Check if server file is created**:

```typescript
// src/routes/test/+page.server.ts should be auto-generated
```

3. **Add a new translation key**:

```svelte
<p>{t.welcome()}</p>
```

4. **Check if server file is updated**:
   The `_translationKeys` array should include `'welcome'`.

### Debugging Steps

1. **Enable verbose mode** in `vite.config.ts`
2. **Check console logs** for plugin activity
3. **Verify file watcher** is working by looking for logs like:

   ```
   📝 .svelte file changed: test.svelte
   🔍 Has i18n imports: true
   🔄 Triggering usage rescan for test.svelte
   ```

4. **Check file permissions** - ensure the plugin can read/write files

### Common Error Messages

- `Could not read file` - File permission or path issues
- `No i18n imports found` - Missing `@i18n` import in `.svelte` file
- `Plugin not detected` - Incorrect plugin configuration

### Performance Considerations

- The plugin scans all `.svelte` files in the routes directory
- Large projects might experience slight delays
- The 100ms debounce delay prevents excessive processing

### Getting Help

If the plugin still doesn't work:

1. Check the console for error messages
2. Verify your SvelteKit version is compatible
3. Ensure all dependencies are up to date
4. Try creating a minimal reproduction case
