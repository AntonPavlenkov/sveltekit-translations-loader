const defaultTranslations = {
	hello: 'Hello (default)',
	goodbye: 'Goodbye (default)',
	welcome: 'Welcome, {{name}}!',
	'user-count': 'There {{count}} users online',
	'nested-params': 'Hello {{name}}, you have {{count}} messages',
	hey: 'Hey {{name}}',
	zap: 'Zap',
	layoutTitle: 'Nested Layout Title',
	layoutDescription: 'This is a layout description that will be inherited by child routes',
	pageTitle: 'Nested Page Title',
	testRealTime: 'Testing real-time generation with new approach!',
	newLine: 'This is a new line',
	pageContent: 'This page content demonstrates nested route translation inheritance',
	continueFn: 'Continue {{count}}'
} as const;

export default defaultTranslations;
