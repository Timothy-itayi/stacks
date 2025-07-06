<script>
  import { onMount } from 'svelte';
  import { Application, Graphics } from 'pixi.js';
  import * as physics from '../lib/physics.js';

  // @ts-ignore
  let container;

  onMount(async () => {
    const GAME_WIDTH = 640;
    const GAME_HEIGHT = 780; // match container height for better sync

    const app = new Application();
    await app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x222222
    });

    // @ts-ignore
    container.appendChild(app.canvas);

    await physics.loadAssets();
    await physics.initPhysics(app);

    const groundHeight = 60;
    const ground = new Graphics();
    ground.beginFill(0x444444);
    ground.drawRect(0, GAME_HEIGHT - groundHeight, GAME_WIDTH, groundHeight);
    ground.endFill();

    ground.lineStyle(2, 0x666666);
    ground.moveTo(0, GAME_HEIGHT - groundHeight);
    ground.lineTo(GAME_WIDTH, GAME_HEIGHT - groundHeight);

    app.stage.addChild(ground);

    physics.createCrate(200, 50, 'brick');
    physics.createCrate(300, 0, 'brick_red');
    physics.createCrate(400, 100, 'brick_yellow');

    app.ticker.add(() => {
      physics.update();
    });
  });
</script>

<!-- Parent flex container to push game window lower -->
<div class="min-h-screen flex flex-col justify-end items-center pb-16">
  <!-- Game window container -->
  <div
    bind:this={container}
    class="w-[640px] h-[780px] rounded-lg overflow-hidden shadow-lg border border-gray-700"
  ></div>
</div>
