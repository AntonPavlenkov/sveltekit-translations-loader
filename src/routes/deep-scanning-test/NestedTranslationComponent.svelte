<script lang="ts">
	import * as t from '@i18n';
	import DeepNestedComponent from './DeepNestedComponent.svelte';
</script>

<div class="p-4 bg-white rounded border">
	<h3 class="text-lg font-medium mb-3">Nested Translation Component</h3>
	
	<div class="space-y-2 mb-4">
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
