import { existsSync, readFileSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

/**
 * Create a simple hash from a string
 */
function createHash(content: string): string {
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return hash.toString();
}

/**
 * Check if file content has actually changed
 */
function hasContentChanged(filePath: string, newContent: string): boolean {
	if (!existsSync(filePath)) {
		return true; // File doesn't exist, so it's a change
	}

	try {
		const existingContent = readFileSync(filePath, 'utf8');
		const existingHash = createHash(existingContent);
		const newHash = createHash(newContent);
		return existingHash !== newHash;
	} catch {
		// If we can't read the existing file, assume it changed
		return true;
	}
}

// Types
interface PendingFileWrite {
	path: string;
	content: string;
	options?: { encoding?: string };
	hasChanged?: boolean; // Track if content actually changed
}

interface BatchFileWriterConfig {
	verbose?: boolean;
	batchSize?: number;
	flushDelay?: number;
}

/**
 * Batch file writer for improved performance
 * Accumulates file write operations and executes them in batches
 */
export class BatchFileWriter {
	private pendingWrites: Map<string, PendingFileWrite> = new Map();
	private flushTimeout: NodeJS.Timeout | null = null;
	private readonly config: Required<BatchFileWriterConfig>;

	constructor(config: BatchFileWriterConfig = {}) {
		this.config = {
			verbose: config.verbose ?? false,
			batchSize: config.batchSize ?? 10,
			flushDelay: config.flushDelay ?? 50
		};
	}

	/**
	 * Queue a file write operation
	 */
	queueWrite(path: string, content: string, options?: { encoding?: string }): void {
		// Check if content has actually changed
		const hasChanged = hasContentChanged(path, content);

		if (!hasChanged) {
			if (this.config.verbose) {
				console.log(`⏭️  Skipping ${path.replace(process.cwd(), '.')} - no changes detected`);
			}
			return; // Don't queue unchanged files
		}

		this.pendingWrites.set(path, { path, content, options, hasChanged: true });

		// Schedule flush if not already scheduled
		if (!this.flushTimeout) {
			this.flushTimeout = setTimeout(() => {
				this.flush();
			}, this.config.flushDelay);
		}

		// Flush immediately if batch size reached
		if (this.pendingWrites.size >= this.config.batchSize) {
			this.flush();
		}
	}

	/**
	 * Queue multiple file write operations
	 */
	queueWrites(
		writes: Array<{ path: string; content: string; options?: { encoding?: string } }>
	): void {
		for (const write of writes) {
			this.queueWrite(write.path, write.content, write.options);
		}
	}

	/**
	 * Execute all pending file writes
	 */
	async flush(): Promise<void> {
		if (this.flushTimeout) {
			clearTimeout(this.flushTimeout);
			this.flushTimeout = null;
		}

		if (this.pendingWrites.size === 0) {
			return;
		}

		const writes = Array.from(this.pendingWrites.values());
		this.pendingWrites.clear();

		if (this.config.verbose) {
			console.log(`📝 Executing batch write of ${writes.length} files`);
		}

		// Group writes by directory to create directories efficiently
		const directoryGroups = new Map<string, PendingFileWrite[]>();

		for (const write of writes) {
			const dir = dirname(write.path);
			if (!directoryGroups.has(dir)) {
				directoryGroups.set(dir, []);
			}
			directoryGroups.get(dir)!.push(write);
		}

		// Create directories and write files
		const promises: Promise<void>[] = [];
		let skippedCount = 0;

		for (const [dir, dirWrites] of directoryGroups) {
			// Ensure directory exists
			try {
				await mkdir(dir, { recursive: true });
			} catch {
				// Directory might already exist, ignore error
			}

			// Write all files in this directory
			for (const write of dirWrites) {
				// Double-check content change before writing (in case file was modified externally)
				const hasChanged = hasContentChanged(write.path, write.content);

				if (!hasChanged) {
					skippedCount++;
					if (this.config.verbose) {
						console.log(
							`⏭️  Skipping ${write.path.replace(process.cwd(), '.')} - no changes detected`
						);
					}
					continue;
				}

				const promise = Promise.resolve()
					.then(() => {
						writeFileSync(write.path, write.content, {
							encoding: (write.options?.encoding as BufferEncoding) || 'utf8'
						});
						if (this.config.verbose) {
							console.log(`✅ Wrote ${write.path.replace(process.cwd(), '.')}`);
						}
					})
					.catch((error) => {
						console.error(`❌ Failed to write ${write.path}:`, error);
					});

				promises.push(promise);
			}
		}

		// Wait for all writes to complete
		await Promise.all(promises);

		if (this.config.verbose) {
			const writtenCount = writes.length - skippedCount;
			const skippedInfo =
				skippedCount > 0 ? ` (${writtenCount} written, ${skippedCount} skipped)` : '';
			console.log(`✅ Completed batch write of ${writes.length} files${skippedInfo}`);
		}
	}

	/**
	 * Force immediate flush and wait for completion
	 */
	async forceFlush(): Promise<void> {
		await this.flush();
	}

	/**
	 * Get the number of pending writes
	 */
	getPendingCount(): number {
		return this.pendingWrites.size;
	}

	/**
	 * Clear all pending writes without executing them
	 */
	clear(): void {
		if (this.flushTimeout) {
			clearTimeout(this.flushTimeout);
			this.flushTimeout = null;
		}
		this.pendingWrites.clear();
	}
}

/**
 * Global batch file writer instance
 */
let globalBatchWriter: BatchFileWriter | null = null;

/**
 * Get or create the global batch file writer
 */
export function getGlobalBatchWriter(config?: BatchFileWriterConfig): BatchFileWriter {
	if (!globalBatchWriter) {
		globalBatchWriter = new BatchFileWriter(config);
	}
	return globalBatchWriter;
}

/**
 * Queue a file write using the global batch writer
 */
export function queueFileWrite(
	path: string,
	content: string,
	options?: { encoding?: string }
): void {
	getGlobalBatchWriter().queueWrite(path, content, options);
}

/**
 * Queue multiple file writes using the global batch writer
 */
export function queueFileWrites(
	writes: Array<{ path: string; content: string; options?: { encoding?: string } }>
): void {
	getGlobalBatchWriter().queueWrites(writes);
}

/**
 * Flush all pending writes using the global batch writer
 */
export async function flushFileWrites(): Promise<void> {
	if (globalBatchWriter) {
		await globalBatchWriter.flush();
	}
}

/**
 * Force flush and wait for completion
 */
export async function forceFlushFileWrites(): Promise<void> {
	if (globalBatchWriter) {
		await globalBatchWriter.forceFlush();
	}
}

/**
 * Clear all pending writes
 */
export function clearFileWrites(): void {
	if (globalBatchWriter) {
		globalBatchWriter.clear();
	}
}
