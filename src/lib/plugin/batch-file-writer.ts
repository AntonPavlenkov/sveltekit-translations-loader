import { writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { hasConsoleNinjaCode, hasContentChanged, readFileContent } from './shared-utils.js';

// Types
interface PendingFileWrite {
	path: string;
	content: string;
	options?: { encoding?: string };
	hasChanged?: boolean; // Track if content actually changed
	retryCount?: number; // Track retry attempts
}

interface BatchFileWriterConfig {
	verbose?: boolean;
	batchSize?: number;
	flushDelay?: number;
	maxRetries?: number; // Maximum retry attempts for file writes
	retryDelay?: number; // Delay between retries
	consoleNinjaGuard?: boolean; // Enable Console Ninja detection guard
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
			flushDelay: config.flushDelay ?? 50,
			maxRetries: config.maxRetries ?? 3,
			retryDelay: config.retryDelay ?? 100,
			consoleNinjaGuard: config.consoleNinjaGuard ?? true
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

		this.pendingWrites.set(path, { path, content, options, hasChanged: true, retryCount: 0 });

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
	 * Execute all pending file writes with retry logic
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
		const retryWrites: PendingFileWrite[] = [];

		for (const [dir, dirWrites] of directoryGroups) {
			// Ensure directory exists
			try {
				await mkdir(dir, { recursive: true });
			} catch {
				// Directory might already exist, ignore error
			}

			// Write all files in this directory
			for (const write of dirWrites) {
				const promise = this.writeFileWithRetry(write)
					.then(() => {
						if (this.config.verbose) {
							console.log(`✅ Wrote ${write.path.replace(process.cwd(), '.')}`);
						}
					})
					.catch((error) => {
						console.error(`❌ Failed to write ${write.path}:`, error);
						// Add to retry list if we haven't exceeded max retries
						if ((write.retryCount || 0) < this.config.maxRetries) {
							retryWrites.push({
								...write,
								retryCount: (write.retryCount || 0) + 1
							});
						}
					});

				promises.push(promise);
			}
		}

		// Wait for all writes to complete
		await Promise.all(promises);

		// Handle retries
		if (retryWrites.length > 0) {
			if (this.config.verbose) {
				console.log(`🔄 Retrying ${retryWrites.length} failed writes...`);
			}

			// Wait a bit before retrying to avoid Console Ninja interference
			await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));

			// Add retry writes back to pending queue
			for (const retryWrite of retryWrites) {
				this.pendingWrites.set(retryWrite.path, retryWrite);
			}

			// Schedule another flush for retries
			if (!this.flushTimeout) {
				this.flushTimeout = setTimeout(() => {
					this.flush();
				}, this.config.retryDelay);
			}
		}

		if (this.config.verbose) {
			console.log(`✅ Completed batch write of ${writes.length} files`);
		}
	}

	/**
	 * Write a single file with retry logic
	 */
	private async writeFileWithRetry(write: PendingFileWrite): Promise<void> {
		const maxAttempts = this.config.maxRetries + 1;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				// Console Ninja Guard: Check if target file contains Console Ninja code
				if (this.config.consoleNinjaGuard) {
					const existingContent = readFileContent(write.path, false);
					if (existingContent && hasConsoleNinjaCode(existingContent)) {
						const relativePath = write.path.replace(process.cwd(), '.');
						console.warn(
							`⚠️  Console Ninja code detected in ${relativePath}. Skipping write to prevent corruption.`
						);
						console.warn(
							`💡 Tip: Wait for Console Ninja to finish, then save your .svelte file again.`
						);
						return; // Skip writing to prevent corruption
					}
				}

				// Double-check content change before writing (in case file was modified externally)
				const hasChanged = hasContentChanged(write.path, write.content);

				if (!hasChanged) {
					if (this.config.verbose) {
						console.log(
							`⏭️  Skipping ${write.path.replace(process.cwd(), '.')} - no changes detected`
						);
					}
					return; // File hasn't changed, no need to write
				}

				// Longer delay for server files to let Console Ninja finish any pending injections
				if (attempt === 1) {
					const isServerFile =
						write.path.includes('+page.server.ts') || write.path.includes('+layout.server.ts');
					const delay = isServerFile ? 150 : 50; // Longer delay for server files
					await new Promise((resolve) => setTimeout(resolve, delay));
				}

				// Write the file
				writeFileSync(write.path, write.content, {
					encoding: (write.options?.encoding as BufferEncoding) || 'utf8'
				});

				// Verify the write was successful by checking if content matches
				await new Promise((resolve) => setTimeout(resolve, 20)); // Small delay for file system sync

				const verifyContent = hasContentChanged(write.path, write.content);
				if (!verifyContent) {
					return; // Write successful
				}

				// Content still doesn't match, might be Console Ninja interference
				if (attempt < maxAttempts) {
					if (this.config.verbose) {
						console.log(
							`⚠️  Write verification failed for ${write.path.replace(process.cwd(), '.')}, retrying... (attempt ${attempt}/${maxAttempts})`
						);
					}
					// Longer delay for retries to avoid Console Ninja interference
					await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay * attempt));
					continue;
				}

				throw new Error('Write verification failed after all retry attempts');
			} catch (error) {
				if (attempt === maxAttempts) {
					throw error; // Re-throw on final attempt
				}

				// Wait before retrying
				await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
			}
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
