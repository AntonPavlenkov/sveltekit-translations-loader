<script lang="ts">
	import * as t from '@i18n';
</script>

<div class="rounded border bg-white p-4">
	<h3 class="mb-3 text-lg font-medium">Deep Scanning Component</h3>

	<div class="space-y-2">
		<p class="text-sm text-gray-700">
			{t.hello()} - This component uses translation keys directly
		</p>
		<p class="text-sm text-gray-700">
			{t.welcome('John')} - The plugin should detect these keys
		</p>
		<p class="text-sm text-gray-700">
			{t.userCount(5)} - Even with parameters
		</p>
	</div>
</div>
