import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { queueFileWrite } from './batch-file-writer.js';
import { hasContentChanged } from './shared-utils.js';

// Constants
const getRouteKeysMapPath = (): string => {
	const basePath = 'src/lib/.translations/_generated/server';
	return `${basePath}/route-keys-map.ts`;
};

const AUTO_GENERATED_MARKERS = {
	START: '// =============================================================================',
	HEADER: '// AUTO-GENERATED CODE BY SVELTEKIT-TRANSLATIONS-LOADER PLUGIN',
	END: '// END AUTO-GENERATED CODE'
} as const;

/**
 * Determine the file type (page or layout) based on the server file path
 */
function determineFileType(serverFilePath: string): 'page' | 'layout' {
	if (serverFilePath.includes('+layout.server.ts')) {
		return 'layout';
	}
	return 'page';
}

/**
 * Generate the route key format used in RouteKeysMap
 * Uses functionId for unique identification instead of route path and file type
 */
function generateRouteKey(functionId: string): string {
	return functionId;
}

/**
 * Parse existing RouteKeysMap from the file
 */
function parseExistingRouteKeysMap(mapPath: string): Map<string, string[]> {
	if (!existsSync(mapPath)) {
		return new Map();
	}

	try {
		const content = readFileSync(mapPath, 'utf8');

		// Extract the Map constructor content
		const mapMatch = content.match(/new Map<string, string\[\]>\(\[([\s\S]*?)\]\)/);
		if (!mapMatch) {
			return new Map();
		}

		const entriesContent = mapMatch[1];
		const entries = entriesContent.split('],').map((entry) => entry.trim());

		const routeKeysMap = new Map<string, string[]>();

		for (const entry of entries) {
			// Parse each entry: ['{route:"/",type:"page"}', ['hello', 'goodbye']]
			const entryMatch = entry.match(/\[([^,]+),\s*\[([^\]]*)\]\]/);
			if (entryMatch) {
				const routeKey = entryMatch[1].replace(/['"]/g, '');
				const keysString = entryMatch[2];
				const keys = keysString
					.split(',')
					.map((key) => key.trim().replace(/['"]/g, ''))
					.filter((key) => key.length > 0);

				routeKeysMap.set(routeKey, keys);
			}
		}

		return routeKeysMap;
	} catch (error) {
		console.warn('⚠️  Failed to parse existing RouteKeysMap:', error);
		return new Map();
	}
}

/**
 * Generate the RouteKeysMap content
 */
function generateRouteKeysMapContent(routeKeysMap: Map<string, string[]>): string {
	const entries = Array.from(routeKeysMap.entries()).map(([routeKey, keys]) => {
		const keysArray = keys.map((key) => `'${key}'`).join(', ');
		return `\t['${routeKey}', [${keysArray}]]`;
	});

	return `// ${AUTO_GENERATED_MARKERS.START}
// ${AUTO_GENERATED_MARKERS.HEADER}
const RouteKeysMap = new Map<string, string[]>([
${entries.join(',\n')}
]);
// ${AUTO_GENERATED_MARKERS.END}

export default RouteKeysMap;
`;
}

/**
 * Update the RouteKeysMap file
 */
function updateRouteKeysMapFile(routeKeysMap: Map<string, string[]>, verbose: boolean): void {
	const mapPath = resolve(getRouteKeysMapPath());
	const newContent = generateRouteKeysMapContent(routeKeysMap);

	// Check if content has actually changed before writing
	if (!hasContentChanged(mapPath, newContent)) {
		if (verbose) {
			console.log(`⏭️  Skipping ${getRouteKeysMapPath()} - no changes detected`);
		}
		return;
	}

	// Ensure the directory exists
	const mapDir = dirname(mapPath);
	if (!existsSync(mapDir)) {
		// Create directory if it doesn't exist
		try {
			mkdirSync(mapDir, { recursive: true });
		} catch (error) {
			console.error(`❌ Failed to create directory ${mapDir}:`, error);
			return;
		}
	}

	// Queue the file write
	queueFileWrite(mapPath, newContent, { encoding: 'utf8' });

	if (verbose) {
		console.log(`✅ Updated ${getRouteKeysMapPath()} with ${routeKeysMap.size} route entries`);
	}
}

/**
 * Inject or update route keys in the RouteKeysMap
 */
export function injectRouteKeysMap(
	routeData: Array<{
		serverFile: string;
		routePath: string;
		keys: Set<string>;
		functionId: string;
	}>,
	defaultPath: string,
	verbose: boolean = false,
	isDevelopment: boolean = false
): void {
	if (verbose) {
		console.log(`🔧 injectRouteKeysMap called for ${routeData.length} routes`);
		console.log(`🔧 Development mode: ${isDevelopment}`);
		console.log(`🔧 RouteKeysMap path: ${getRouteKeysMapPath()}`);
	}

	const mapPath = resolve(getRouteKeysMapPath());

	// Parse existing RouteKeysMap from the file
	const existingMap = parseExistingRouteKeysMap(mapPath);

	// Process all routes and build the complete map
	for (const { serverFile, routePath, keys, functionId } of routeData) {
		// Determine file type
		const fileType = determineFileType(serverFile);

		// Generate route key using functionId
		const routeKey = generateRouteKey(functionId);

		// Convert usedKeys Set to array
		const keysArray = Array.from(keys);

		if (verbose) {
			console.log(`📝 Route: ${routePath}, Type: ${fileType}, Keys: [${keysArray.join(', ')}]`);
		}

		// Check if this route already exists
		const existingKeys = existingMap.get(routeKey);

		if (existingKeys) {
			// Route exists, check if keys have changed
			const existingKeysSet = new Set(existingKeys);
			const newKeysSet = new Set(keysArray);

			// Check if keys are the same
			if (
				existingKeysSet.size === newKeysSet.size &&
				Array.from(existingKeysSet).every((key) => newKeysSet.has(key))
			) {
				if (verbose) {
					console.log(`⏭️  Route ${routeKey} already exists with same keys, skipping update`);
				}
				continue; // Skip to next route
			}

			if (verbose) {
				console.log(`🔄 Updating existing route ${routeKey} with new keys`);
				console.log(`   Old keys: [${existingKeys.join(', ')}]`);
				console.log(`   New keys: [${keysArray.join(', ')}]`);
			}
		} else {
			if (verbose) {
				console.log(`➕ Adding new route ${routeKey} with keys: [${keysArray.join(', ')}]`);
			}
		}

		// Update the map
		existingMap.set(routeKey, keysArray);
	}

	// Update the file with all collected route data
	updateRouteKeysMapFile(existingMap, verbose);
}
