<script lang="ts">
	import {} from '@sveltekit-translations-loader';
	import '../app.css';
	import type { LayoutData } from './$types.js';

	let { data }: { data: LayoutData } = $props();

	// Language switching function
	async function switchLanguage(locale: string) {
		console.log('🔄 Switching to loc ale:', locale);
		try {
			const response = await fetch('/api/language', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ locale })
			});

			if (response.ok) {
				console.log('✅ Language switched successfully, reloading page...');
				// Reload the page to apply new language
				window.location.reload();
			} else {
				const errorText = await response.text();
				console.error('❌ Failed to switch language:', errorText);
			}
		} catch (error) {
			console.error('❌ Language switching error:', error);
		}
	}
</script>

<svelte:head>
	<title>Transhake Demo</title>
	<meta name="description" content="Tree-shakable translations for Svelte 5" />
</svelte:head>

<!-- Language Switcher -->
<div class="fixed top-4 right-4 z-50">
	<select
		value={data.locale}
		onchange={(e) => switchLanguage(e.currentTarget.value)}
		class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
	>
		{#each data.availableLocales as locale}
			<option value={locale}>
				{locale === 'en-US'
					? '🇺🇸 English'
					: locale === 'de-DE'
						? '🇩🇪 Deutsch'
						: locale === 'es-ES'
							? '🇪🇸 Español'
							: locale === 'fr-FR'
								? '🇫🇷 Français'
								: locale}
			</option>
		{/each}
	</select>
</div>

<nav class="main-nav">
	<a href="/">Home</a>
	<a href="/some-page">Some Page</a>
	<a href="/nested-example">Nested Example</a>
</nav>

<main>
	<slot />
</main>

<style>
	.main-nav {
		background: #2c3e50;
		padding: 1rem 2rem;
		display: flex;
		gap: 2rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.main-nav a {
		color: white;
		text-decoration: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: background-color 0.3s;
	}

	.main-nav a:hover {
		background: #5a6c7d;
	}
</style>
