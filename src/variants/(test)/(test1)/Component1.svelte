<script lang="ts">
	import Component2 from '@variants/(test)/(test1)/Component2.svelte';
	import { onMount } from 'svelte';

	let mount = $state(false);

	onMount(() => {
		mount = true;
	});
</script>

{#if mount}
	<Component2 />
{/if}
