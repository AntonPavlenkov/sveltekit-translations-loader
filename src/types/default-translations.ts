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
	continueFn: 'Continue {{count}}',
	test_lib_page_title: 'Test $lib Imports',
	test_lib_page_description: 'This page tests deep scanning with $lib imports',
	lib_component_title: 'Component from $lib',
	lib_component_message: 'This component is imported from $lib and should be scanned'
} as const;

export default defaultTranslations;
