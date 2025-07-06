<script>
  import GameCanvas from '../components/GameCanvas.svelte';
  import HUD from '../components/HUD.svelte';
</script>

<main>
  <HUD />
  <GameCanvas />
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
