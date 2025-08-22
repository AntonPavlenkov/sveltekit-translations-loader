<script lang="ts">
	import * as t from '@i18n';
	import AliestTester from '@variants/AliestTester.svelte';

	let isLoaded = $state(false);
	console.log(t.welcome('Sababa'));
</script>

{#if isLoaded}
	<AliestTester />

	<p>Alias tester: {t.hey('df')}</p>
{/if}
