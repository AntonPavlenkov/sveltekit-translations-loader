<script lang="ts">
	import * as t from '@i18n';

	// This component is statically imported
	let showMessage = $state(true);
</script>

<div class="space-y-2">
	<div class="rounded bg-emerald-100 p-3">
		<h4 class="font-medium text-emerald-800">🔗 Statically Imported Component</h4>
		<p class="text-sm text-emerald-700">
			{t.pageContent()} - This component is imported using traditional static import
		</p>
	</div>

	<button
		onclick={() => (showMessage = !showMessage)}
		class="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600"
	>
		Toggle Message
	</button>

	{#if showMessage}
		<div class="rounded bg-emerald-50 p-2">
			<p class="text-sm">
				{t.hello()} from nested static component! {t.goodbye()}
			</p>
			<p class="mt-1 text-xs text-gray-600">
				All these translation keys should be detected and included in +page.server.ts
			</p>
		</div>
	{/if}
</div>
