<script lang="ts">
	import * as t from '@i18n';
</script>

<div>
	<h4>Deep Nested Component</h4>
	<p>This component is deeply nested and uses translations:</p>
	<ul>
		<li>{t.hello()}</li>
		<li>{t.welcome('John')}</li>
		<li>{t.goodbye()}</li>
		<li>{t.zap()}</li>
	</ul>
</div>
