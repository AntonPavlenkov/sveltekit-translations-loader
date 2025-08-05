<script lang="ts">
	import * as t from '@i18n';

	// Demonstrate different dynamic import patterns
	let components: any[] = $state([]);
	let loadingStates = $state({
		pattern1: false,
		pattern2: false,
		pattern3: false
	});

	// Pattern 1: const variable = await import()
	async function loadPattern1() {
		loadingStates.pattern1 = true;
		try {
			const comp = await import('./nested-dynamic-component.svelte');
			components = [...components, { name: 'Pattern 1', component: comp.default }];
		} catch (error) {
			console.error('Pattern 1 failed:', error);
		} finally {
			loadingStates.pattern1 = false;
		}
	}

	// Pattern 2: let variable = await import()
	async function loadPattern2() {
		loadingStates.pattern2 = true;
		try {
			let dynamicComp = await import('./nested-dynamic-component.svelte');
			components = [...components, { name: 'Pattern 2', component: dynamicComp.default }];
		} catch (error) {
			console.error('Pattern 2 failed:', error);
		} finally {
			loadingStates.pattern2 = false;
		}
	}

	// Pattern 3: Direct import() call
	async function loadPattern3() {
		loadingStates.pattern3 = true;
		try {
			import('./nested-dynamic-component.svelte').then((module) => {
				components = [...components, { name: 'Pattern 3', component: module.default }];
				loadingStates.pattern3 = false;
			});
		} catch (error) {
			console.error('Pattern 3 failed:', error);
			loadingStates.pattern3 = false;
		}
	}

	function clearComponents() {
		components = [];
	}
</script>

<div class="rounded-lg bg-indigo-50 p-6">
	<h3 class="mb-4 text-lg font-semibold text-indigo-800">⚡ Advanced Dynamic Import Patterns</h3>

	<div class="space-y-4">
		<p class="text-sm text-gray-600">
			{t.layoutDescription()} - Testing different dynamic import syntaxes that the scanner should detect
		</p>

		<div class="grid gap-3 sm:grid-cols-3">
			<button
				onclick={loadPattern1}
				disabled={loadingStates.pattern1}
				class="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{loadingStates.pattern1 ? 'Loading...' : 'const = await import()'}
			</button>

			<button
				onclick={loadPattern2}
				disabled={loadingStates.pattern2}
				class="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{loadingStates.pattern2 ? 'Loading...' : 'let = await import()'}
			</button>

			<button
				onclick={loadPattern3}
				disabled={loadingStates.pattern3}
				class="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{loadingStates.pattern3 ? 'Loading...' : 'import().then()'}
			</button>
		</div>

		{#if components.length > 0}
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h4 class="font-medium text-indigo-800">
						Loaded Components ({components.length})
					</h4>
					<button
						onclick={clearComponents}
						class="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
					>
						Clear All
					</button>
				</div>

				{#each components as { name, component }, index (index)}
					<div class="rounded border bg-white p-3">
						<p class="mb-2 text-sm font-medium text-indigo-700">{name}:</p>
						<component></component>
					</div>
				{/each}
			</div>
		{/if}

		<div class="rounded bg-indigo-100 p-3">
			<p class="text-xs text-indigo-700">
				<strong>{t.hello()}!</strong> Each pattern should be detected by the scanner and all translation
				keys should be auto-injected into +page.server.ts
			</p>
		</div>
	</div>
</div>
