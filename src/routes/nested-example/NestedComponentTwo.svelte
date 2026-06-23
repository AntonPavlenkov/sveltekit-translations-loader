<script lang="ts">
	import * as t from '@i18n';
	import DeepNestedComponent from './DeepNestedComponent.svelte';
</script>

<div>
	<h3>Nested Component Two</h3>
	<p>{t.hello()}</p>
	<p>{t.welcome('World')}</p>
	<p>{t.userCount(5)}</p>

	<DeepNestedComponent />
</div>
