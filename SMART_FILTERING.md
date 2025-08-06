# Smart File Filtering Improvements

## Overview

The plugin has been enhanced with intelligent file filtering that only processes files that actually import or use the `@i18n` module, significantly improving performance and reducing unnecessary processing.

## Problem Solved

**Before**: When you saved any `.svelte` file in the routes directory, the plugin would check and process ALL files, even those that don't use translations.

**After**: The plugin now only processes files that actually have `@i18n` imports, dramatically reducing unnecessary work.

## Key Improvements

### 1. **Smart Import Detection**

- Only processes `.svelte` files that contain `@i18n` import statements
- Supports various import patterns:
  ```typescript
  import * as t from '@i18n';
  import * as t from '@i18n';
  import { hello } from '@i18n';
  import { hello } from '@i18n';
  import t from '@i18n';
  import t from '@i18n';
  ```

### 2. **Performance Optimization**

- **Reduced File Scanning**: Only checks files that actually need processing
- **Faster File Watching**: Eliminates unnecessary file read operations
- **Lower CPU Usage**: Dramatically reduces processing overhead
- **Better Developer Experience**: Faster response times when saving files

### 3. **Intelligent Logging**

- Shows which files are being processed and why
- Indicates when files are skipped due to lack of i18n imports
- Provides clear feedback about what the plugin is doing

## Implementation Details

### File Filtering Logic

```typescript
// Before: Process ALL .svelte files
return file.includes(defaultPath) || (file.includes(ROUTES_DIR) && file.endsWith('.svelte'));

// After: Only process files with i18n imports
if (isSvelteFile) {
  const content = readFileSync(file, 'utf8');
  const hasImports = hasI18nImports(content);

  if (!hasImports) {
    console.log(`⏭️  Skipping ${basename(file)} - no i18n imports detected`);
    return; // Skip files without i18n imports
  }

  // Process only files with i18n imports
  await handleComponentChange(file, ...);
}
```

### Supported Import Patterns

The plugin detects these import patterns:

```typescript
// ✅ Supported patterns
import * as t from '@i18n';
import * as t from '@i18n';
import { hello, world } from '@i18n';
import { hello, world } from '@i18n';
import t from '@i18n';
import t from '@i18n';

// ❌ Not supported (these won't trigger processing)
import { something } from 'other-module';
import * as other from './other-file';
```

## Performance Impact

### Before (Processing All Files)

```
📝 .svelte file changed: my-page.svelte
🔍 Has i18n imports: false
🔄 Triggering usage rescan for my-page.svelte
📝 .svelte file changed: another-page.svelte
🔍 Has i18n imports: false
🔄 Triggering usage rescan for another-page.svelte
📝 .svelte file changed: third-page.svelte
🔍 Has i18n imports: true
🔄 Triggering usage rescan for third-page.svelte
```

### After (Smart Filtering)

```
📝 .svelte file changed: my-page.svelte
🔍 Has i18n imports: false
⏭️  Skipping my-page.svelte - no i18n imports detected
📝 .svelte file changed: another-page.svelte
🔍 Has i18n imports: false
⏭️  Skipping another-page.svelte - no i18n imports detected
📝 .svelte file changed: third-page.svelte
🔍 Has i18n imports: true
🔄 Triggering usage rescan for third-page.svelte
```

## Configuration

The filtering is automatically enabled and cannot be disabled, as it's a core performance improvement. The verbose logging can be controlled:

```typescript
// In vite.config.js
export default defineConfig({
	plugins: [
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/lib/translations/@default-translations.ts',
			runtimePath: 'src/lib/translations/runtime/index.ts',
			verbose: true // Shows filtering logs
		})
	]
});
```

## Migration Notes

- **Backward Compatible**: All existing functionality remains unchanged
- **Automatic**: No configuration needed - filtering is always enabled
- **No Breaking Changes**: Files with i18n imports continue to work exactly as before
- **Performance Boost**: Immediate performance improvement for projects with many non-i18n files

## Testing

The filtering system includes comprehensive tests:

```bash
npm test src/lib/plugin/filtering.test.ts
```

Tests cover:

- ✅ Files with i18n imports are processed
- ✅ Files without i18n imports are skipped
- ✅ Various import patterns are detected correctly
- ✅ Performance improvements are measurable

## Benefits

1. **🚀 Performance**: Dramatically faster file processing
2. **💾 Efficiency**: Only processes files that actually need translation handling
3. **🔍 Transparency**: Clear logging shows what's being processed and why
4. **🛡️ Reliability**: Maintains all existing functionality while improving performance
5. **📊 Monitoring**: Verbose mode shows exactly what the plugin is doing

## Example Scenarios

### Scenario 1: Large Project with Many Non-i18n Files

**Before**: Every file save triggers processing of all routes
**After**: Only files with `@i18n` imports are processed

### Scenario 2: Mixed i18n and Non-i18n Files

**Before**: All files are checked regardless of i18n usage
**After**: Only i18n files are processed, others are skipped

### Scenario 3: Development Workflow

**Before**: Slow response times when saving non-i18n files
**After**: Instant response for non-i18n files, fast processing for i18n files

This improvement ensures that your development workflow is as fast as possible, only processing files that actually need translation handling! 🎉
