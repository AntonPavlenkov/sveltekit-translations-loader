<script lang="ts">
	import * as t from '@i18n';

	// This component demonstrates dynamic imports with translation usage
	let dynamicComponent: any = $state(null);
	let isLoading = $state(false);

	async function loadDynamicComponent() {
		isLoading = true;
		try {
			// Dynamic import - the scanner should now detect this!
			const component = await import('./nested-dynamic-component.svelte');
			dynamicComponent = component.default;
		} catch (error) {
			console.error('Failed to load dynamic component:', error);
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="rounded-lg bg-purple-50 p-6">
	<h3 class="mb-4 text-lg font-semibold text-purple-800">🔄 Dynamic Import Showcase</h3>

	<div class="space-y-4">
		<p class="text-sm text-gray-600">
			{t.pageContent()} - This component uses dynamic imports with translations
		</p>

		<div class="rounded border bg-white p-4">
			<p class="mb-2"><strong>Static translation:</strong> {t.hello()}</p>
			<p class="mb-4"><strong>With params:</strong> {t.userCount(99)}</p>

			<button
				onclick={loadDynamicComponent}
				disabled={isLoading}
				class="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
			>
				{isLoading ? 'Loading...' : 'Load Dynamic Component'}
			</button>
		</div>

		{#if dynamicComponent}
			<div class="rounded border bg-purple-100 p-4">
				<p class="mb-2 text-sm font-medium text-purple-800">Dynamically loaded component:</p>
				<!-- Directly render the component -->
				<dynamicComponent></dynamicComponent>
			</div>
		{/if}
	</div>
</div>
