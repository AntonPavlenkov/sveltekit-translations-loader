<script lang="ts">
	import * as t from '@i18n';
</script>

<div class="nested-layout">
	<header>
		<h1>{t.layoutTitle()}</h1>
		<p>{t.layoutDescription()}</p>
		<p>{t.hello()}</p>
		<p>{t.hey('Joh    n')}</p>
	</header>

	<main>
		<slot />
	</main>
</div>

<style>
	.nested-layout {
		padding: 1rem;
		border: 2px solid #e5e7eb;
		margin: 1rem;
	}

	header {
		background: #f3f4f6;
		padding: 1rem;
		margin-bottom: 1rem;
	}
</style>
