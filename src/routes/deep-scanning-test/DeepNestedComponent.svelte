<script lang="ts">
	import * as t from '@i18n';
</script>

<div class="rounded border-l-4 border-blue-500 bg-gray-50 p-3">
	<h4 class="text-md mb-2 font-medium">Deep Nested Component</h4>

	<div class="space-y-1">
		<p class="text-xs text-gray-600">
			{t.hello()} - This is the deepest level
		</p>
		<p class="text-xs text-gray-600">
			{t.welcome(1)} - The plugin should find these keys too
		</p>
		<p class="text-xs text-gray-600">
			{t.continueFn(1)} - Even reserved words with Fn suffix
		</p>
	</div>
</div>
