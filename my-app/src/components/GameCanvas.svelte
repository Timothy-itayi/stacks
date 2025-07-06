<script>
  import { onMount } from 'svelte';
  import { Application, Assets, Sprite } from 'pixi.js';
  // @ts-ignore
  import matter from 'matter-js';
  const { Engine, Bodies, World } = matter;

  // DOM container for Pixi
  // @ts-ignore
  let container;

  onMount(async () => {
    // 1. Create PIXI app
    const app = new Application();
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x222222,
      webgl: {
        antialias: true
      },
      webgpu: {
        antialias: false
      }
    });

    // Append canvas
    // @ts-ignore
    container.appendChild(app.canvas);

    // 2. Setup Matter.js
    const engine = Engine.create();
    const world = engine.world;

    // Add ground
    const ground = Bodies.rectangle(
      window.innerWidth / 2,
      window.innerHeight - 30,
      window.innerWidth,
      60,
      { isStatic: true }
    );
    World.add(world, [ground]);

    // 3. Asset manifest (update aliases and filenames as needed)
    const manifest = {
      bundles: [
        {
          name: 'bricks',
          assets: [
            { alias: 'brick', src: 'assets/brick_high_2.png' },
            { alias: 'brick_red', src: 'assets/brick_high_4.png' },
            { alias: 'brick_yellow', src: 'assets/brick_high_6.png' }
          ]
        }
      ]
    };

    await Assets.init({ manifest });
    await Assets.loadBundle('bricks');

    // 4. Create crate
    // @ts-ignore
    const createCrate = (x, y, alias = 'brick') => {
      const texture = Assets.get(alias);
      const body = Bodies.rectangle(x, y, 80, 80);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = 80;
      sprite.height = 80;
      app.stage.addChild(sprite);

      return { body, sprite };
    };

    const crates = [
      createCrate(200, 100, 'brick'),
      createCrate(300, 100, 'brick_red'),
      createCrate(400, 100, 'brick_yellow')
    ];

    crates.forEach(crate => World.add(world, crate.body));

    // 5. Animation loop
    app.ticker.add(() => {
      Engine.update(engine);

      crates.forEach(({ body, sprite }) => {
        sprite.x = body.position.x;
        sprite.y = body.position.y;
        sprite.rotation = body.angle;
      });
    });
  });
</script>

<!-- Game canvas mount point -->
<div bind:this={container}></div>

<style>
  div {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
