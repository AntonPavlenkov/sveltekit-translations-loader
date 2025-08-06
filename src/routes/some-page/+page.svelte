<script lang="ts">
	import * as t from '@i18n';
	import AliestTester from '@variants/AliestTester.svelte';

	let { data } = $props();

	console.log('🚀 ~ da  t   a :', data);
</script>

{t.zap()}

<AliestTester />
