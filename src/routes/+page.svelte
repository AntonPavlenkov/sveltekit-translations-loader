<script lang="ts">
	import * as t from '@i18n';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<div class="container mx-auto space-y-6 p-8">
	<header class="mb-8 text-center">
		<h1 class="mb-2 text-4xl font-bold text-gray-800">🌐 Svel teKit Translations Importer</h1>
		<p class="text-lg text-gray-600">
			Tree-shakable translations with auto-injected load functions
		</p>
		<p class="mt-2 text-sm text-gray-500">Current language: <strong>{data.locale}</strong></p>
	</header>

	<div class="grid gap-6 md:grid-cols-2">
		<!-- Auto-injected Translations -->
		<div class="rounded-lg bg-green-50 p-6">
			<h2 class="mb-4 text-xl font-semibold text-green-800">🚀 Auto-injected Translations</h2>
			<div class="space-y-2">
				<p class="text-sm text-gray-600">
					Plugin scanned this file and auto-created +page.server.ts with only used keys
				</p>
				<div class="rounded border bg-white p-3">
					<p><strong>t.hello():</strong> {t.hello()}</p>
					<p><strong>t.welcome():</strong> {t.welcome('User')}</p>
					<p><strong>t.userCount():</strong> {t.userCount(42)}</p>
					<p><strong>t.goodbye():</strong> {t.goodbye()}</p>
				</div>
			</div>
		</div>

		<!-- Tree-shaking Demo -->
		<div class="rounded-lg bg-blue-50 p-6">
			<h2 class="mb-4 text-xl font-semibold text-blue-800">🌳 Tree-shaking</h2>
			<div class="space-y-2">
				<p class="text-sm text-gray-600">
					Only functions used in this file are included in +page.server.ts
				</p>
				<div class="rounded border bg-white p-3">
					<p class="text-xs text-gray-500">
						Check src/routes/+page.server.ts to see auto-generated keys
					</p>
					<p class="text-xs text-gray-500">
						Available: {Object.keys(data._loadedTranslations).join(', ')}
					</p>
				</div>
			</div>
		</div>

		<!-- Parameter Support -->
		<div class="rounded-lg bg-purple-50 p-6">
			<h2 class="mb-4 text-xl font-semibold text-purple-800">⚙️ Parameter Support</h2>
			<div class="space-y-2">
				<p class="text-sm text-gray-600">Translation functions support parameter interpolation</p>
				<div class="rounded border bg-white p-3">
					<p><strong>t.welcome():</strong> {t.welcome('Alice')}</p>
					<p><strong>t.userCount():</strong> {t.userCount(123)}</p>
					<p><strong>t.nestedParams():</strong> {t.nestedParams({ name: 'Bob', count: 5 })}</p>
				</div>
			</div>
		</div>

		<!-- Zero Runtime Overhead -->
		<div class="rounded-lg bg-yellow-50 p-6">
			<h2 class="mb-4 text-xl font-semibold text-yellow-800">⚡ Zero Runtime Overhead</h2>
			<div class="space-y-2">
				<p class="text-sm text-gray-600">Translations loaded once via SvelteKit load function</p>
				<div class="rounded border bg-white p-3">
					<p class="text-xs text-gray-500">✓ Tree-shakable (only used keys loaded)</p>
					<p class="text-xs text-gray-500">✓ Server-side translations via load function</p>
					<p class="text-xs text-gray-500">✓ Auto-injection based on usage scanning</p>
					<p class="text-xs text-gray-500">✓ Type-safe with JSDoc hover documentation</p>
				</div>
			</div>
		</div>

		<!-- Recursive Component Scanning -->
		<div class="rounded-lg bg-orange-50 p-6">
			<h2 class="mb-4 text-xl font-semibold text-orange-800">🔄 Recursive Scanning</h2>
			<div class="space-y-2">
				<p class="text-sm text-gray-600">Plugin scans imported components for translation usage</p>
				<div class="rounded border bg-white p-3">
					<p class="text-xs text-gray-500">✓ Scans all imported Svelte components</p>
					<p class="text-xs text-gray-500">✓ Detects translation usage patterns</p>
					<p class="text-xs text-gray-500">✓ Auto-injects keys into load functions</p>
				</div>
			</div>
		</div>
	</div>
</div>
