import { isAbsolute, resolve } from 'path';

/**
 * Single source of truth for the project root the plugin is allowed to touch.
 *
 * Everything the plugin scans, watches, reads, or writes MUST stay inside this
 * directory. This is what keeps the plugin from crawling into sibling packages
 * in a monorepo. It defaults to `process.cwd()` and is overridden with Vite's
 * resolved `config.root` (or an explicit `root` plugin option) once available.
 */
let projectRoot = process.cwd();

function toPosix(p: string): string {
	return p.replace(/\\/g, '/');
}

/**
 * Set the authoritative project root. No-op for empty values so callers can
 * safely pass `config.root ?? options.root` without guarding.
 */
export function setProjectRoot(root: string | undefined | null): void {
	if (root && root.trim().length > 0) {
		projectRoot = resolve(root);
	}
}

/**
 * Get the absolute project root.
 */
export function getProjectRoot(): string {
	return projectRoot;
}

/**
 * Resolve path segments against the project root (NOT `process.cwd()`).
 */
export function resolveFromRoot(...segments: string[]): string {
	return resolve(projectRoot, ...segments);
}

/**
 * Project root as a normalized (posix-style) string, for prefix comparisons.
 */
export function getNormalizedRoot(): string {
	return toPosix(projectRoot);
}

/**
 * True when an absolute (or project-relative) path lives inside the project
 * root. This is the hard boundary the rest of the plugin relies on.
 */
export function isInsideProjectRoot(targetPath: string): boolean {
	const absolute = isAbsolute(targetPath) ? targetPath : resolve(projectRoot, targetPath);
	const normalized = toPosix(absolute);
	const root = getNormalizedRoot();
	return normalized === root || normalized.startsWith(`${root}/`);
}
