<script lang="ts">
	import * as t from '@i18n';
	import type { PageData } from './$types.js';
	// Static imports - traditional approach
	import AdvancedDynamicShowcase from './advanced-dynamic-showcase.svelte';
	import DynamicShowcase from './dynamic-showcase-component.svelte';
	import StaticShowcase from './static-showcase-component.svelte';

	let { data }: { data: PageData } = $props();

	// Some dynamic imports in the main page as well
	let additionalComponent: any = $state(null);

	async function loadAdditionalExample() {
		// Another dynamic import example
		const module = await import('./nested-dynamic-component.svelte');
		additionalComponent = module.default;
	}
</script>

<div class="container mx-auto space-y-6 p-8">
	<header class="mb-8 text-center">
		<h1 class="mb-2 text-4xl font-bold text-gray-800">🌐 SvelteKit Translations Loader</h1>
		<p class="text-lg text-gray-600">
			Tree-shakable translations with auto-injected load functions
		</p>
		<p class="text-lg font-medium text-purple-600">✨ Now with Dynamic Import Support! ✨</p>
		<p class="mt-2 text-sm text-gray-500">Current language: <strong>{data.locale}</strong></p>
	</header>

	<!-- Feature Overview -->
	<div class="mb-6 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 p-6">
		<h2 class="mb-4 text-xl font-semibold text-gray-800">🎯 Key Features Showcase</h2>
		<div class="grid gap-4 md:grid-cols-3">
			<div class="rounded bg-white p-4">
				<h3 class="font-medium text-blue-800">📦 Static Imports</h3>
				<p class="text-sm text-gray-600">Traditional static component imports</p>
			</div>
			<div class="rounded bg-white p-4">
				<h3 class="font-medium text-purple-800">🔄 Dynamic Imports</h3>
				<p class="text-sm text-gray-600">New! Runtime component loading</p>
			</div>
			<div class="rounded bg-white p-4">
				<h3 class="font-medium text-green-800">🌳 Tree-shaking</h3>
				<p class="text-sm text-gray-600">Auto-injected used translations only</p>
			</div>
		</div>

		<div class="mt-4 rounded bg-yellow-100 p-3">
			<p class="text-sm text-yellow-800">
				<strong>Auto-generated:</strong>
				{t.pageTitle()} - Check +page.server.ts to see all detected translation keys!
			</p>
		</div>
	</div>

	<!-- Main Page Direct Usage -->
	<div class="mb-6 rounded-lg bg-gray-50 p-6">
		<h2 class="mb-4 text-xl font-semibold text-gray-800">📝 Direct Usage Examples</h2>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="rounded border bg-white p-4">
				<h3 class="mb-2 font-medium text-gray-800">Static translations in this file:</h3>
				<div class="space-y-1 text-sm">
					<p><strong>t.hello():</strong> {t.hello()}</p>
					<p><strong>t.welcome():</strong> {t.welcome('Main Page')}</p>
					<p><strong>t.userCount():</strong> {t.userCount(123)}</p>
					<p><strong>t.pageContent():</strong> {t.pageContent()}</p>
				</div>
			</div>

			<div class="rounded border bg-white p-4">
				<h3 class="mb-2 font-medium text-gray-800">Dynamic loading example:</h3>
				<button
					onclick={loadAdditionalExample}
					class="mb-3 rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
				>
					Load Component Dynamically
				</button>

				{#if additionalComponent}
					<div class="rounded bg-gray-100 p-3">
						<additionalComponent></additionalComponent>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Showcase Components -->
	<div class="space-y-6">
		<!-- Static Import Showcase -->
		<StaticShowcase />

		<!-- Dynamic Import Showcase -->
		<DynamicShowcase />

		<!-- Advanced Dynamic Import Patterns -->
		<AdvancedDynamicShowcase />
	</div>

	<!-- Technical Details -->
	<div class="mt-8 rounded-lg bg-gray-50 p-6">
		<h2 class="mb-4 text-xl font-semibold text-gray-800">🔧 How It Works</h2>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="space-y-3">
				<h3 class="font-medium text-gray-800">Scanner Detection:</h3>
				<ul class="space-y-1 text-sm text-gray-600">
					<li>✅ <code>import Component from './Component.svelte'</code></li>
					<li>✅ <code>import &#123; Component &#125; from './Component.svelte'</code></li>
					<li>✅ <code>const c = await import('./Component.svelte')</code></li>
					<li>✅ <code>let c = await import('./Component.svelte')</code></li>
					<li>✅ <code>import('./Component.svelte')</code></li>
					<li>✅ <code>t.continueFn()</code> <span class="text-red-600">(reserved words)</span></li>
					<li>✅ <code>t['continue']()</code> <span class="text-red-600">(safe access)</span></li>
				</ul>
			</div>

			<div class="space-y-3">
				<h3 class="font-medium text-gray-800">Translation Detection:</h3>
				<ul class="space-y-1 text-sm text-gray-600">
					<li>• Scans ALL imported components (static + dynamic)</li>
					<li>• Follows nested import chains recursively</li>
					<li>• Avoids circular dependencies</li>
					<li>• Auto-injects only used keys to server files</li>
					<li>• Tree-shakes unused translation functions</li>
					<li>
						• <strong class="text-red-600">NEW:</strong> Safely handles JavaScript reserved words
					</li>
				</ul>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<footer class="pt-8 text-center">
		<p class="text-sm text-gray-500">
			{t.goodbye()} - Happy coding with SvelteKit Translations Loader!
		</p>
		<div class="mt-3 rounded bg-gray-100 p-3">
			<p class="text-xs text-gray-600">
				<strong>Available Keys:</strong>
				{Object.keys(data._loadedTranslations).join(', ')}
			</p>
			<p class="mt-1 text-xs text-gray-600">
				Check <code>+page.server.ts</code> to see all auto-detected and injected translation keys
			</p>
		</div>
	</footer>
</div>
