<script lang="ts">
	import * as t from '@i18n';
	import DeepNestedComponent from './DeepNestedComponent.svelte';
</script>

<div class="rounded border bg-white p-4">
	<h3 class="mb-3 text-lg font-medium">Nested Translation Component</h3>

	<div class="mb-4 space-y-2">
		<p class="text-sm text-gray-700">
			{t.pageContent()} - This component also has translation keys
		</p>
		<p class="text-sm text-gray-700">
			{t.goodbye()} - And uses nested components
		</p>
	</div>

	<!-- This nested component also has translation usage -->
	<DeepNestedComponent />
</div>
