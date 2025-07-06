// lib/physics.js
import matter from 'matter-js';
import { Sprite, Assets } from 'pixi.js';

// @ts-ignore
const { Engine, Bodies, World, Runner, Mouse, MouseConstraint, Events } = matter;

let engine;
// @ts-ignore
let world;
let runner;
// @ts-ignore
let app;
// @ts-ignore
let crates = [];
let mouseConstraint;

// @ts-ignore
export async function initPhysics(pixiApp) {
  app = pixiApp;
  engine = Engine.create();
  world = engine.world;
  runner = Runner.create();

  engine.gravity.y = 1;

  // Add ground
  const ground = Bodies.rectangle(
    app.renderer.width / 2,
    app.renderer.height - 30,
    app.renderer.width,
    60,
    { isStatic: true, restitution: 0.3 }
  );
  World.add(world, ground);

  // Setup mouse dragging for physics bodies
  const mouse = Mouse.create(app.canvas);
  mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  World.add(world, mouseConstraint);

  Runner.run(runner, engine);

  crates = [];
  return { engine, world, runner, mouseConstraint };
}

export async function loadAssets() {
  const manifest = {
    bundles: [
      {
        name: 'bricks',
        assets: [
          { alias: 'brick', src: '/assets/brick_high_2.png' },
          { alias: 'brick_red', src: '/assets/brick_high_4.png' },
          { alias: 'brick_yellow', src: '/assets/brick_high_6.png' }
        ]
      }
    ]
  };
  await Assets.init({ manifest });
  await Assets.loadBundle('bricks');
}

// @ts-ignore
export function createCrate(x, y, alias = 'brick') {
  const texture = Assets.get(alias);
  const width = 80;
  const height = 80;

  const body = Bodies.rectangle(x, y, width, height, {
    restitution: 0.1,
    friction: 0.5,
    density: 0.001
  });

  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = width;
  sprite.height = height;
  // @ts-ignore
  app.stage.addChild(sprite);

  crates.push({ body, sprite });
  // @ts-ignore
  World.add(world, body);

  return { body, sprite };
}

export function update() {
  // @ts-ignore
  crates.forEach(({ body, sprite }) => {
    sprite.x = body.position.x;
    sprite.y = body.position.y;
    sprite.rotation = body.angle;
  });
}