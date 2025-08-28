<script lang="ts">
	import * as t from '@i18n';
	import DeepNestedComponent from './DeepNestedComponent.svelte';
</script>

<div>
	{t.pageContent()} - {t.goodbye()}
	<DeepNestedComponent />
</div>