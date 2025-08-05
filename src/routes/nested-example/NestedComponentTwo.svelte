<script lang="ts">
	import * as t from '@i18n';
	import DeepNestedComponent from './DeepNestedComponent.svelte';
</script>

<div>
	<h3>Nested Component Two</h3>
	<p>{t.hello()}</p>
	<p>{t.zap()}</p>
	<p>{t.welcome()}</p>
	<p>{t.userCount({ count: 5 })}</p>

	<DeepNestedComponent />
</div>
