import { existsSync, readFileSync, rmdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BatchFileWriter, flushFileWrites, queueFileWrite } from './batch-file-writer.js';

describe('BatchFileWriter', () => {
	const testDir = join(process.cwd(), 'test-batch-writer');
	const testFile1 = join(testDir, 'file1.txt');
	const testFile2 = join(testDir, 'file2.txt');

	beforeEach(() => {
		// Clean up any existing test files
		try {
			if (existsSync(testFile1)) unlinkSync(testFile1);
			if (existsSync(testFile2)) unlinkSync(testFile2);
			if (existsSync(testDir)) rmdirSync(testDir);
		} catch {
			// Ignore cleanup errors
		}
	});

	afterEach(() => {
		// Clean up after tests
		try {
			if (existsSync(testFile1)) unlinkSync(testFile1);
			if (existsSync(testFile2)) unlinkSync(testFile2);
			if (existsSync(testDir)) rmdirSync(testDir);
		} catch {
			// Ignore cleanup errors
		}
	});

	it('should write files in batches', async () => {
		const writer = new BatchFileWriter({ verbose: false, batchSize: 2, flushDelay: 10 });

		// Queue multiple writes
		writer.queueWrite(testFile1, 'content1');
		writer.queueWrite(testFile2, 'content2');

		// Force flush
		await writer.forceFlush();

		// Add a small delay to ensure files are written to disk
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Verify files were written
		expect(existsSync(testFile1)).toBe(true);
		expect(existsSync(testFile2)).toBe(true);
		expect(readFileSync(testFile1, 'utf8')).toBe('content1');
		expect(readFileSync(testFile2, 'utf8')).toBe('content2');
	});

	it('should handle global batch writer', async () => {
		// Use global batch writer
		queueFileWrite(testFile1, 'global content');
		await flushFileWrites();

		// Verify file was written
		expect(existsSync(testFile1)).toBe(true);
		expect(readFileSync(testFile1, 'utf8')).toBe('global content');
	});

	it('should create directories automatically', async () => {
		const nestedFile = join(testDir, 'nested', 'file.txt');
		const writer = new BatchFileWriter();

		writer.queueWrite(nestedFile, 'nested content');
		await writer.forceFlush();

		// Verify file and directory were created
		expect(existsSync(nestedFile)).toBe(true);
		expect(readFileSync(nestedFile, 'utf8')).toBe('nested content');
	});

	it('should handle multiple writes to same file', async () => {
		const writer = new BatchFileWriter();

		// Queue multiple writes to same file (last one should win)
		writer.queueWrite(testFile1, 'first content');
		writer.queueWrite(testFile1, 'second content');
		writer.queueWrite(testFile1, 'final content');

		await writer.forceFlush();

		// Verify only the last content was written
		expect(existsSync(testFile1)).toBe(true);
		expect(readFileSync(testFile1, 'utf8')).toBe('final content');
	});

	it('should skip unchanged files', async () => {
		const writer = new BatchFileWriter({ verbose: true });

		// Write initial content
		writer.queueWrite(testFile1, 'initial content');
		await writer.forceFlush();

		// Try to write the same content again
		writer.queueWrite(testFile1, 'initial content');
		await writer.forceFlush();

		// Verify file still has the same content
		expect(existsSync(testFile1)).toBe(true);
		expect(readFileSync(testFile1, 'utf8')).toBe('initial content');
	});

	it('should write changed content even if file exists', async () => {
		const writer = new BatchFileWriter();

		// Write initial content
		writer.queueWrite(testFile1, 'initial content');
		await writer.forceFlush();

		// Write different content
		writer.queueWrite(testFile1, 'updated content');
		await writer.forceFlush();

		// Verify file was updated
		expect(existsSync(testFile1)).toBe(true);
		expect(readFileSync(testFile1, 'utf8')).toBe('updated content');
	});
});
