<script lang="ts">
	import * as t from '@i18n';

	// This component will be dynamically imported
	// The scanner should find these translation keys through dynamic import chain
	let count = $state(0);
	let showDetails = $state(false);
</script>

<div class="space-y-3">
	<div class="rounded bg-yellow-100 p-3">
		<h4 class="font-medium text-yellow-800">🎯 Dynamically Loaded Component</h4>
		<p class="text-sm text-yellow-700">
			{t.welcome('Dynamic Component')} - This text comes from a dynamically imported component!
		</p>
	</div>

	<div class="flex gap-2">
		<button
			onclick={() => count++}
			class="rounded bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
		>
			Increment: {count}
		</button>

		<button
			onclick={() => (showDetails = !showDetails)}
			class="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
		>
			{showDetails ? 'Hide' : 'Show'} Details
		</button>
	</div>

	{#if showDetails}
		<div class="rounded bg-gray-100 p-3">
			<p class="text-sm">
				<strong>{t.pageTitle()}:</strong>
				{t.pageContent()} - Dynamic Component Details
			</p>
			<p class="text-sm">
				<strong>Count:</strong>
				{t.userCount(count)}
			</p>
			<p class="mt-2 text-sm text-gray-600">
				{t.goodbye()} (This should be detected by the scanner!)
			</p>
		</div>
	{/if}
</div>
