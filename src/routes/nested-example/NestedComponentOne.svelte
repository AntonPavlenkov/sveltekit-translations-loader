<script lang="ts">
	import * as t from '@i18n';
	import NestedComponentTwo from './NestedComponentTwo.svelte';
</script>

<div>
	<h3>Nested Component One</h3>
	<p>{t.nestedParams({ name: 'John', count: 42 })}</p>
</div>

<NestedComponentTwo />
