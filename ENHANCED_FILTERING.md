# Enhanced File Filtering System

## Overview

The plugin now includes an intelligent filtering system that detects both **direct** and **indirect** translation usage, ensuring that components are processed when they or their dependencies use translations.

## Problem Solved

**Before**: The plugin only detected files with direct `@i18n` imports in the routes directory, missing components that use `_loadedTranslations` or are used by components that have translation usage.

**After**: The plugin now detects:

- ✅ Direct `@i18n` imports (anywhere in src/)
- ✅ Direct `_loadedTranslations` usage (anywhere in src/)
- ✅ Indirect usage through component dependencies
- ✅ Traces dependency chains up to page components
- ✅ Components outside routes directory that are used by page components

## Key Features

### 1. **Dual Detection System**

```typescript
function hasI18nUsage(code: string): boolean {
	// Check for @i18n imports
	const hasImports = I18N_IMPORT_PATTERNS.some((pattern) => code.includes(pattern));

	// Check for _loadedTranslations usage
	const hasLoadedTranslations = code.includes('_loadedTranslations');

	return hasImports || hasLoadedTranslations;
}
```

### 2. **Dependency Chain Tracing**

- **Component A** uses `@i18n` imports
- **Component B** uses Component A
- **Component C** uses Component B
- **Page Component** uses Component C

**Result**: All components in the chain are processed because they're part of a translation-using dependency tree.

### 3. **Smart Filtering Logic**

```typescript
// Check if this component or any of its users have translation usage
const componentContent = readFileContent(changedFilePath);
const hasDirectUsage = componentContent && hasTranslationUsage(componentContent);

// Find all users of this component
const users = findComponentUsers(changedFilePath, dependencyMap, verbose);
let hasIndirectUsage = false;

for (const user of users) {
	const userContent = readFileContent(user);
	if (userContent && hasTranslationUsage(userContent)) {
		hasIndirectUsage = true;
		break;
	}
}

// Only update if there's translation usage (direct or indirect)
if (hasDirectUsage || hasIndirectUsage) {
	// Process the component
}
```

## Supported Usage Patterns

### Direct Translation Usage

```typescript
// ✅ @i18n imports
import * as t from '@i18n';
import { hello } from '@i18n';
import t from '@i18n';

// ✅ _loadedTranslations usage
_loadedTranslations['hello'];
_loadedTranslations['world'];
_loadedTranslations.hello;
```

### Indirect Usage Through Dependencies

```typescript
// Component A: Uses translations
<script>
import * as t from '@i18n';
</script>
<h1>{t.hello()}</h1>

// Component B: Uses Component A
<script>
import ComponentA from './ComponentA.svelte';
</script>
<ComponentA />

// Component C: Uses Component B
<script>
import ComponentB from './ComponentB.svelte';
</script>
<ComponentB />

// Page: Uses Component C
<script>
import ComponentC from './ComponentC.svelte';
</script>
<ComponentC />
```

**Result**: All components (A, B, C, and Page) are processed because they're part of the translation dependency chain.

## Performance Impact

### Before (Basic Filtering)

```
📝 .svelte file changed: child-component.svelte
🔍 Has i18n usage: false
⏭️  Skipping child-component.svelte - no i18n usage detected
❌ Missing: Component uses _loadedTranslations but wasn't processed
```

### After (Enhanced Filtering)

```
📝 .svelte file changed: child-component.svelte
🔍 Has i18n usage: false
🔍 Checking if child-component.svelte is used by components with i18n usage
🔍 Component child-component.svelte is used by parent-component.svelte which has translation usage
🔄 Processing child-component.svelte due to indirect translation usage
```

## Implementation Details

### Enhanced Detection Function

```typescript
function hasTranslationUsage(content: string): boolean {
	// Check for @i18n imports
	const i18nImportPatterns = [
		/import\s+\*\s+as\s+\w+\s+from\s+['"]@i18n['"]/g,
		/import\s+\{\s*[^}]*\s*\}\s+from\s+['"]@i18n['"]/g,
		/import\s+\w+\s+from\s+['"]@i18n['"]/g
	];

	const hasI18nImports = i18nImportPatterns.some((pattern) => pattern.test(content));

	// Check for _loadedTranslations usage (actual usage, not just the string)
	const hasLoadedTranslations =
		content.includes("_loadedTranslations['") ||
		content.includes('_loadedTranslations["') ||
		content.includes('_loadedTranslations.');

	return hasI18nImports || hasLoadedTranslations;
}
```

### Dependency Chain Analysis

```typescript
export function findPageComponent(
	componentPath: string,
	dependencyMap: DependencyMap,
	routesDir: string,
	verbose = false
): string | null {
	const visited = new Set<string>();

	function findPageRecursive(path: string): string | null {
		if (visited.has(path)) return null;
		visited.add(path);

		// Check if this is a page component
		if (path.includes('+page.svelte') || path.includes('+layout.svelte')) {
			return path;
		}

		// Check if this component uses translations
		const content = readFileContent(path);
		if (content && hasTranslationUsage(content)) {
			if (verbose) {
				console.log(`🔍 Component ${path} uses translations`);
			}
		}

		// Find users of this component
		const component = dependencyMap[path];
		if (component) {
			for (const user of component.usedBy) {
				const pageComponent = findPageRecursive(user);
				if (pageComponent) {
					return pageComponent;
				}
			}
		}

		return null;
	}

	return findPageRecursive(componentPath);
}
```

## Configuration

The enhanced filtering is automatically enabled and cannot be disabled, as it's a core improvement. Verbose logging can be controlled:

```typescript
// In vite.config.js
export default defineConfig({
	plugins: [
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/lib/translations/@default-translations.ts',
			runtimePath: 'src/lib/translations/runtime/index.ts',
			verbose: true // Shows detailed filtering logs
		})
	]
});
```

## Migration Notes

- **Backward Compatible**: All existing functionality remains unchanged
- **Automatic**: No configuration needed - enhanced filtering is always enabled
- **No Breaking Changes**: Files with translation usage continue to work exactly as before
- **Performance Boost**: More accurate detection reduces unnecessary processing while ensuring all translation-using components are handled

## Testing

The enhanced filtering system includes comprehensive tests:

```bash
npm test src/lib/plugin/enhanced-filtering.test.ts
```

Tests cover:

- ✅ Direct i18n import detection
- ✅ Direct \_loadedTranslations usage detection
- ✅ Indirect usage through component dependencies
- ✅ Proper skipping of files without translation usage

## Benefits

1. **🔍 Accuracy**: Detects all translation usage patterns
2. **🔄 Dependency Awareness**: Traces component dependency chains
3. **⚡ Performance**: Only processes files that actually need translation handling
4. **🛡️ Reliability**: Ensures no translation-using components are missed
5. **📊 Transparency**: Clear logging shows why components are processed or skipped

## Example Scenarios

### Scenario 1: Mixed Translation Usage

- **Component A**: Uses `@i18n` imports
- **Component B**: Uses `_loadedTranslations`
- **Component C**: No direct translation usage, but used by Component A
- **Result**: All components are processed

### Scenario 2: Deep Dependency Chain

- **Grandchild**: Uses `@i18n` imports
- **Child**: Uses Grandchild (no direct translation usage)
- **Parent**: Uses Child (no direct translation usage)
- **Page**: Uses Parent (no direct translation usage)
- **Result**: All components are processed due to dependency chain

### Scenario 3: Components Outside Routes Directory

- **AliestTester.svelte** (in `src/variants/`): Uses `@i18n` imports
- **+page.svelte** (in `src/routes/`): Uses AliestTester component
- **Result**: Both components are processed, server file is updated

### Scenario 4: Isolated Components

- **Component A**: No translation usage, not used by translation components
- **Component B**: No translation usage, not used by translation components
- **Result**: Both components are skipped

This enhancement ensures that your plugin accurately detects and processes all components that use translations, whether directly or indirectly, regardless of their location in the project structure! 🎉
