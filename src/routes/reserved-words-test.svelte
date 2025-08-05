<script lang="ts">
	import * as t from '@i18n';

	// Test translation keys that are JavaScript reserved words
	// These should be handled safely by the scanner and function generator

	let showDetails = $state(false);
</script>

<div class="rounded-lg bg-red-50 p-6">
	<h3 class="mb-4 text-lg font-semibold text-red-800">⚠️ Reserved Words Test</h3>

	<div class="space-y-4">
		<p class="text-sm text-gray-600">
			Testing translation keys that are JavaScript reserved words. The plugin should handle these
			safely by using bracket notation or Fn suffix.
		</p>

		<div class="rounded border bg-white p-4">
			<div class="space-y-2">
				<p class="text-sm"><strong>Test Cases:</strong></p>

				<!-- These should work if we have keys named after reserved words -->
				<!-- The plugin should generate continueFn(), functionFn(), etc. -->
				<!-- Or use bracket notation: t['continue'](), t['function']() -->

				{#if typeof (t as any).continueFn === 'function'}
					<p class="text-sm text-green-600">✅ continueFn: {(t as any).continueFn()}</p>
				{:else}
					<p class="text-sm text-orange-600">
						⚠️ continueFn: Not available (add 'continue' key to test)
					</p>
				{/if}

				{#if typeof (t as any).functionFn === 'function'}
					<p class="text-sm text-green-600">✅ functionFn: {(t as any).functionFn()}</p>
				{:else}
					<p class="text-sm text-orange-600">
						⚠️ functionFn: Not available (add 'function' key to test)
					</p>
				{/if}

				{#if typeof (t as any).classFn === 'function'}
					<p class="text-sm text-green-600">✅ classFn: {(t as any).classFn()}</p>
				{:else}
					<p class="text-sm text-orange-600">⚠️ classFn: Not available (add 'class' key to test)</p>
				{/if}

				<!-- Test bracket notation access -->
				<div class="mt-3 rounded bg-gray-100 p-2">
					<p class="text-xs text-gray-700">
						<strong>Safe Access Pattern:</strong> Reserved words should be accessible via:
					</p>
					<code class="text-xs">t.continueFn()</code> or
					<code class="text-xs">t['continue']()</code>
				</div>
			</div>

			<button
				onclick={() => (showDetails = !showDetails)}
				class="mt-3 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
			>
				{showDetails ? 'Hide' : 'Show'} Technical Details
			</button>
		</div>

		{#if showDetails}
			<div class="rounded border bg-red-100 p-4">
				<h4 class="mb-2 font-medium text-red-800">How Reserved Words Are Handled:</h4>
				<ul class="space-y-1 text-sm text-red-700">
					<li>
						• JavaScript reserved words like 'continue', 'function', 'class' cannot be used as
						property names in dot notation
					</li>
					<li>
						• The plugin detects these and appends 'Fn' suffix: continueFn, functionFn, classFn
					</li>
					<li>• Scanner patterns are updated to detect both t.continueFn() and t['continue']()</li>
					<li>
						• Function generation creates safe function names while preserving original translation
						keys
					</li>
					<li>• Both approaches work: t.continueFn() and t['continue']()</li>
				</ul>

				<div class="mt-3 rounded bg-white p-3">
					<p class="text-xs text-gray-600">
						<strong>To test:</strong> Add translation keys like "continue", "function", "class" to your
						default-translations.ts and save this file to see the scanner detect and auto-inject them
						into +page.server.ts
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
