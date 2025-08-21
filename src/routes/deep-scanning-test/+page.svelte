<script lang="ts">
	// This page has NO direct translation usage
	// It only imports and uses components that have translation keys
	import DeepScanningComponent from './DeepScanningComponent.svelte';
	import NestedTranslationComponent from './NestedTranslationComponent.svelte';
</script>

<svelte:head>
	<title>Deep Scanning Test</title>
</svelte:head>

<main class="container mx-auto p-8">
	<h1 class="mb-6 text-3xl font-bold">Deep Scanning Test Page</h1>
	<p class="mb-8 text-gray-600">
		This page has no direct translation usage, but uses components that do have translation keys.
		The plugin should detect these keys through deep scanning.
	</p>

	<div class="grid gap-6">
		<div class="rounded-lg border bg-blue-50 p-6">
			<h2 class="mb-4 text-xl font-semibold">Component with Direct Translation Usage</h2>
			<DeepScanningComponent />
		</div>

		<div class="rounded-lg border bg-green-50 p-6">
			<h2 class="mb-4 text-xl font-semibold">Nested Component with Translation Usage</h2>
			<NestedTranslationComponent />
		</div>
	</div>
</main>
