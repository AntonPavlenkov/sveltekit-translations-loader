<script lang="ts">
	import * as t from '@i18n';
	// Static import - traditional approach that was already working
	import NestedStaticComponent from './nested-static-component.svelte';

	let showNested = $state(false);
	let counter = $state(0);
</script>

<div class="rounded-lg bg-green-50 p-6">
	<h3 class="mb-4 text-lg font-semibold text-green-800">📦 Static Import Showcase</h3>

	<div class="space-y-4">
		<p class="text-sm text-gray-600">
			{t.layoutDescription()} - Traditional static imports - this was already working before the dynamic
			import enhancement
		</p>

		<div class="rounded border bg-white p-4">
			<div class="space-y-2">
				<p><strong>Static translations:</strong></p>
				<p class="text-sm">• {t.hello()}</p>
				<p class="text-sm">• {t.welcome('Static Component')}</p>
				<p class="text-sm">• {t.userCount(counter)}</p>
			</div>

			<div class="mt-3 flex gap-2">
				<button
					onclick={() => counter++}
					class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
				>
					Count: {counter}
				</button>

				<button
					onclick={() => (showNested = !showNested)}
					class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
				>
					{showNested ? 'Hide' : 'Show'} Nested
				</button>
			</div>
		</div>

		{#if showNested}
			<div class="rounded border bg-green-100 p-4">
				<p class="mb-2 text-sm font-medium text-green-800">Statically imported component:</p>
				<NestedStaticComponent />
			</div>
		{/if}
	</div>
</div>
