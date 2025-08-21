<script lang="ts">
	import LibTestComponent from '$lib/components/LibTestComponent.svelte';
	import * as t from '@i18n';
</script>

<h1>{t.testLibPageTitle()}</h1>
<p>{t.testLibPageDescription()}</p>

<LibTestComponent />

<div class="test-info">
	<p>This page tests if deep scanning picks up components imported from $lib</p>
	<p>It should find translation keys from both this page and the LibTestComponent</p>
</div>
