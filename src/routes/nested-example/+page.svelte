<script lang="ts">
	import * as t from '@sveltekit-translations-loader';
</script>

<div class="nested-page">
	<h2>{t.pageTitle()}</h2>
	<p>{t.pageContent()}</p>

	<!-- This will have access to both layout and page translation keys -->
	<div class="combined-content">
		<h3>Combined Keys Demo:</h3>
		<p>Layout title: {t.layoutTitle()}</p>
		<p>Page title: {t.pageTitle()}</p>
		<p>This demonstrates nested route translation inheritance!</p>
		<p>
			Dynamic keys are available: {t.nestedParams({ name: 'John', count: 42 }) || 'Not available'}
		</p>
	</div>
</div>

<style>
	.nested-page {
		padding: 1rem;
		background: #f9fafb;
	}

	.combined-content {
		margin-top: 1rem;
		padding: 1rem;
		background: #e5e7eb;
		border-radius: 0.5rem;
	}
</style>
