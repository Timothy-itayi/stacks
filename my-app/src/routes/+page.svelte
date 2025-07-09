<script>
	import GameCanvas from '$components/GameCanvas.svelte';
  import GameScreen from '$components/GameCanvas.svelte'; // This is the wrapper that includes GameCanvas + HUD
</script>

<main>
  <GameCanvas/>
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
