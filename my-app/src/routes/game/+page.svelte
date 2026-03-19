<script>
	import { onMount } from 'svelte';
	import GameCanvas from '$components/GameCanvas.svelte';
	import MobileGameCanvas from '$components/mobile/GameCanvas.svelte';

	let isMobile = false;
	let mounted = false;

	onMount(() => {
		mounted = true;
		const check = () => { isMobile = window.innerWidth < 768; };
		check();
		window.addEventListener('resize', check);
		return () => window.removeEventListener('resize', check);
	});
</script>

<main>
	{#if mounted}
		{#if isMobile}
			<MobileGameCanvas />
		{:else}
			<GameCanvas />
		{/if}
	{/if}
</main>

<style>
  main {
    overflow: hidden;
    margin: 0;
    padding: 0;
    background: #111;
    height: 100vh;
    width: 100vw;
  }
</style>
