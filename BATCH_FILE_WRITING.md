# Batch File Writing Improvements

## Overview

The plugin has been enhanced with a batch file writing system that significantly improves performance by accumulating file write operations and executing them in optimized batches.

## Key Benefits

### 1. **Performance Improvement**

- **Reduced I/O Operations**: Instead of writing files one by one, the system now batches multiple writes together
- **Efficient Directory Creation**: Directories are created once per batch rather than for each individual file
- **Parallel Processing**: Multiple files in the same directory are written concurrently
- **Smart Change Detection**: Files are only written if their content has actually changed, avoiding unnecessary disk operations

### 2. **Better Resource Management**

- **Debounced Execution**: File writes are automatically flushed after a configurable delay (default: 50ms)
- **Batch Size Control**: Writes are flushed immediately when the batch size is reached (default: 10 files)
- **Memory Efficiency**: Uses a Map to deduplicate writes to the same file

### 3. **Improved Developer Experience**

- **Verbose Logging**: Optional detailed logging of batch operations
- **Error Handling**: Graceful error handling with fallback to individual writes
- **Automatic Cleanup**: Pending writes are flushed when the plugin is destroyed

## Implementation Details

### BatchFileWriter Class

```typescript
interface BatchFileWriterConfig {
	verbose?: boolean; // Enable detailed logging
	batchSize?: number; // Max files per batch (default: 10)
	flushDelay?: number; // Auto-flush delay in ms (default: 50)
}
```

### Key Features

1. **Smart Deduplication**: Multiple writes to the same file are deduplicated, with the last write winning
2. **Content Change Detection**: Files are only written if their content has actually changed
3. **Directory Grouping**: Files are grouped by directory for efficient directory creation
4. **Automatic Flushing**: Files are flushed automatically after a delay or when batch size is reached
5. **Global Instance**: A global batch writer is available for use across the entire plugin

### Usage Examples

```typescript
// Queue individual file writes
queueFileWrite('/path/to/file.txt', 'content');

// Queue multiple file writes
queueFileWrites([
	{ path: '/path/to/file1.txt', content: 'content1' },
	{ path: '/path/to/file2.txt', content: 'content2' }
]);

// Force flush all pending writes
await forceFlushFileWrites();
```

## Performance Impact

### Before (Individual Writes)

```
📝 Writing file1.ts... ✅
📝 Writing file2.ts... ✅
📝 Writing file3.ts... ✅
📝 Writing file4.ts... ✅
📝 Writing file5.ts... ✅
```

### After (Batch Writes with Change Detection)

```
📝 Executing batch write of 5 files
⏭️  Skipping ./file1.ts - no changes detected
✅ Wrote ./file2.ts
⏭️  Skipping ./file3.ts - no changes detected
✅ Wrote ./file4.ts
✅ Wrote ./file5.ts
✅ Completed batch write of 5 files (3 written, 2 skipped)
```

## Configuration

The batch file writer can be configured through the plugin options:

```typescript
// In vite.config.js
export default defineConfig({
	plugins: [
		sveltekitTranslationsImporterPlugin({
			defaultPath: 'src/lib/translations/@default-translations.ts',
			runtimePath: 'src/lib/translations/runtime/index.ts',
			verbose: true // Enables batch writing logs
			// Batch writer is automatically configured with sensible defaults
		})
	]
});
```

## Migration Notes

- **Backward Compatible**: All existing functionality remains unchanged
- **Automatic Integration**: The batch writer is automatically used by all file writing operations
- **No Breaking Changes**: Existing plugin configuration continues to work as before

## Testing

The batch file writer includes comprehensive tests covering:

- Basic batch writing functionality
- Global batch writer usage
- Automatic directory creation
- File deduplication
- Content change detection
- Error handling

Run tests with:

```bash
npm test batch-file-writer
```

## Future Enhancements

Potential future improvements:

- **Compression**: Batch compression for large files
- **Caching**: Smart caching of frequently written files
- **Metrics**: Performance metrics and monitoring
- **Async Queue**: Background processing queue for very large batches
