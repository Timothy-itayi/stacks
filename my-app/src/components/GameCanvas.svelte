<script>
  import { onMount } from 'svelte';
  import { Application } from 'pixi.js';
  import * as physics from '../lib/physics.js';

  // @ts-ignore
  let container;

  onMount(async () => {
    // 1. Init PIXI app the way you do
    const app = new Application();
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x222222
    });

    // @ts-ignore
    container.appendChild(app.canvas);

    // 2. Load assets & init physics passing PIXI app
    await physics.loadAssets();
    await physics.initPhysics(app);

    // 3. Create crates
    physics.createCrate(200, 50, 'brick');
    physics.createCrate(300, 0, 'brick_red');
    physics.createCrate(400, 100, 'brick_yellow');

    // 4. Sync physics and rendering every frame
    app.ticker.add(() => {
      physics.update();
    });
  });
</script>

<div bind:this={container} style="width: 100%; height: 100%; overflow: hidden;"></div>
