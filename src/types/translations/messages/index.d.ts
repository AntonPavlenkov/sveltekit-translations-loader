// Auto-generated TypeScript declarations
interface TranslationParams {
	[key: string]: string | number;
}

/**
 * @description Hello (default)
 */
export declare const hello: () => string;

/**
 * @description Goodbye (default)
 */
export declare const goodbye: () => string;

/**
 * @description Welcome, {{name}}!
 */
export declare const welcome: (params?: TranslationParams) => string;

/**
 * @description There {{count}} users online
 */
export declare const userCount: (params?: TranslationParams) => string;

/**
 * @description Hello {{name}}, you have {{count}} messages
 */
export declare const nestedParams: (params?: TranslationParams) => string;

/**
 * @description Hey {{name}}
 */
export declare const hey: (params?: TranslationParams) => string;

/**
 * @description Zap
 */
export declare const zap: () => string;

/**
 * @description Nested Layout Title
 */
export declare const layoutTitle: () => string;

/**
 * @description This is a layout description that will be inherited by child routes
 */
export declare const layoutDescription: () => string;

/**
 * @description Nested Page Title
 */
export declare const pageTitle: () => string;

/**
 * @description This page content demonstrates nested route translation inheritance
 */
export declare const pageContent: () => string;

