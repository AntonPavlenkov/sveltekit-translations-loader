export const injectRouteKeysMap = (
	serverFilePath: string,
	usedKeys: Set<string>,
	routePath: string,
	defaultPath: string,
	verbose: boolean = false,
	isDevelopment: boolean = false
) => {
	console.log('🔧 injectRouteKeysMap called for: ', serverFilePath);
};
