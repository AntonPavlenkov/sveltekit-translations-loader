# Expected Console Output During Dev Server Startup

When you start the dev server with verbose mode enabled, you should see the following output in your console:

## 1. Initial Route Discovery

```
🔍 Found 1 pages with translation usage
🔍 Processing route file: ./src/routes/deep-scanning-test/+page.svelte (deep-scanning-test)
```

## 2. Deep Scanning Process

```
🔍 Scanning component: ./src/routes/deep-scanning-test/+page.svelte
📦 Found 2 imports in ./src/routes/deep-scanning-test/+page.svelte: [
  './DeepScanningComponent.svelte',
  './NestedTranslationComponent.svelte'
]
```

## 3. First Component Scan

```
🔗 Following import: ./DeepScanningComponent.svelte
🔍 Scanning component: ./DeepScanningComponent.svelte
🔍 Found 4 translation keys in ./DeepScanningComponent.svelte: [
  'hello', 'welcome', 'userCount', 'user-count'
]
🔍 Found 4 keys in ./DeepScanningComponent.svelte: [
  'hello', 'welcome', 'userCount', 'user-count'
]
✅ Finished scanning ./DeepScanningComponent.svelte, total keys: 4
```

## 4. Second Component Scan

```
🔗 Following import: ./NestedTranslationComponent.svelte
🔍 Scanning component: ./NestedTranslationComponent.svelte
🔍 Found 3 translation keys in ./NestedTranslationComponent.svelte: [
  'pageContent', 'page-content', 'goodbye'
]
🔍 Found 3 keys in ./NestedTranslationComponent.svelte: [
  'pageContent', 'page-content', 'goodbye'
]
📦 Found 1 imports in ./NestedTranslationComponent.svelte: [
  './DeepNestedComponent.svelte'
]
```

## 5. Nested Component Scan

```
🔗 Following import: ./DeepNestedComponent.svelte
🔍 Scanning component: ./DeepNestedComponent.svelte
🔍 Found 5 translation keys in ./DeepNestedComponent.svelte: [
  'hello', 'welcome', 'continueFn', 'continue', 'continue-fn'
]
🔍 Found 5 keys in ./DeepNestedComponent.svelte: [
  'hello', 'welcome', 'continueFn', 'continue', 'continue-fn'
]
✅ Finished scanning ./DeepNestedComponent.svelte, total keys: 5
```

## 6. Component Completion

```
✅ Finished scanning ./NestedTranslationComponent.svelte, total keys: 8
✅ Finished scanning ./src/routes/deep-scanning-test/+page.svelte, total keys: 10
```

## 7. Final Summary

```
🔍 Found 10 translation keys in ./src/routes/deep-scanning-test/+page.svelte (including dependencies): [
  'hello', 'welcome', 'userCount', 'user-count', 'pageContent',
  'page-content', 'goodbye', 'continueFn', 'continue', 'continue-fn'
]
```

## 8. Server File Update

```
📝 Resolved keys for route deep-scanning-test: [
  'hello', 'welcome', 'userCount', 'user-count', 'pageContent',
  'page-content', 'goodbye', 'continueFn', 'continue', 'continue-fn'
]
```

## Key Points Demonstrated

1. **No Direct Usage**: The main page (`+page.svelte`) has NO translation keys
2. **Deep Discovery**: Plugin finds keys in components 2 levels deep
3. **Import Following**: Automatically follows all import chains
4. **Key Aggregation**: Collects keys from entire component tree
5. **Variant Detection**: Finds both camelCase and kebab-case versions
6. **Reserved Word Handling**: Properly handles `continueFn` → `continue` + `continue-fn`

## What This Means

✅ **Before**: Plugin only scanned the immediate page file  
✅ **After**: Plugin now scans the entire component dependency tree

This is exactly what you wanted - the plugin now works like a "rune time check" that discovers all translation keys regardless of how deeply nested they are in the component hierarchy!
