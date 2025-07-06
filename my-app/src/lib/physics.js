// lib/physics.js
import matter from 'matter-js';
import { Sprite, Assets } from 'pixi.js';

// @ts-ignore
const { Engine, Bodies, World, Runner, Mouse, MouseConstraint, Events, Body } = matter;

let engine;
// @ts-ignore
let world;
let runner;
// @ts-ignore
let app;
// @ts-ignore
let crates = [];
let mouseConstraint;

// Available block aliases
const BLOCK_ALIASES = ['block', 'block00', 'block01', 'block02', 'block03', 'block04'];

// @ts-ignore
export async function initPhysics(pixiApp) {
  app = pixiApp;
  engine = Engine.create();
  world = engine.world;
  runner = Runner.create();

  engine.gravity.y = 1;

  const width = app.renderer.width;
  const height = app.renderer.height;
  const wallThickness = 60;

  // Ground
  const ground = Bodies.rectangle(width / 2, height - 30, width, 60, {
    isStatic: true,
    restitution: 0.3
  });
  World.add(world, ground);

  // Walls
  const leftWall = Bodies.rectangle(wallThickness / 2, height / 2, wallThickness, height, {
    isStatic: true
  });
  const rightWall = Bodies.rectangle(width - wallThickness / 2, height / 2, wallThickness, height, {
    isStatic: true
  });
  World.add(world, leftWall);
  World.add(world, rightWall);

  // Mouse drag
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
          { alias: 'block', src: '/assets/block.png' },
          { alias: 'block00', src: '/assets/block00.png' },
          { alias: 'block01', src: '/assets/block01.png' },
          { alias: 'block02', src: '/assets/block02.png' },
          { alias: 'block03', src: '/assets/block03.png' },
          { alias: 'block04', src: '/assets/block04.png' },
        ]
      }
    ]
  };
  
  try {
    await Assets.init({ manifest });
    await Assets.loadBundle('bricks');
    console.log('Assets loaded successfully');
  } catch (error) {
    console.error('Failed to load assets:', error);
    // Fallback: create colored rectangles if assets fail to load
    return false;
  }
  return true;
}

// @ts-ignore
export function createCrate(x, y, alias = null) {
  // If no alias provided, pick a random one
  if (!alias) {
    // @ts-ignore
    alias = BLOCK_ALIASES[Math.floor(Math.random() * BLOCK_ALIASES.length)];
  }
  
  const width = 80;
  const height = 80;

  const body = Bodies.rectangle(x, y, width, height, {
    restitution: 0.1,
    friction: 0.5,
    frictionAir: 0.02,
    density: 0.001
  });

  let sprite;
  
  try {
    // Try to get the texture
    // @ts-ignore
    const texture = Assets.get(alias);
    if (texture) {
      sprite = new Sprite(texture);
    } else {
      throw new Error(`Texture ${alias} not found`);
    }
  } catch (error) {
    console.warn(`Failed to load texture ${alias}, using fallback`, error);
    // Create a colored rectangle as fallback
    sprite = createFallbackSprite(width, height, alias);
  }

  sprite.anchor.set(0.5);
  sprite.width = width;
  sprite.height = height;
  // @ts-ignore
  app.stage.addChild(sprite);

  // Link sprite to body for easy removal later
  // @ts-ignore
  body.sprite = sprite;

  const crateObj = { body, sprite };
  crates.push(crateObj);
  // @ts-ignore
  World.add(world, body);

  return crateObj;
}

// @ts-ignore
function createFallbackSprite(width, height, alias) {
  // Create a colored rectangle using PIXI Graphics as fallback
  // @ts-ignore
  const graphics = new PIXI.Graphics();
  
  // Different colors for different aliases
  const colors = {
    'block': 0x8B4513,    // Brown
    'block00': 0xFF6B6B,  // Red
    'block01': 0x4ECDC4,  // Teal
    'block02': 0x45B7D1,  // Blue
    'block03': 0x96CEB4,  // Green
    'block04': 0xFECA57   // Yellow
  };
  
  // @ts-ignore
  const color = colors[alias] || 0x8B4513;
  
  graphics.beginFill(color);
  graphics.drawRoundedRect(-width/2, -height/2, width, height, 8);
  graphics.endFill();
  
  // Add border
  graphics.lineStyle(2, 0x000000, 0.3);
  graphics.drawRoundedRect(-width/2, -height/2, width, height, 8);
  
  return graphics;
}

export function update() {
  // @ts-ignore
  crates.forEach(({ body, sprite }) => {
    sprite.x = body.position.x;
    sprite.y = body.position.y;
    sprite.rotation = body.angle;
  });
}

export function getCurrentStackHeight() {
  if (crates.length === 0) return 0;

  // @ts-ignore
  const minY = Math.min(...crates.map(c => c.body.position.y));
  // @ts-ignore
  const canvasBottom = app.renderer.height;
  const heightInPixels = canvasBottom - minY;
  const meters = heightInPixels / 80;
  return meters;
}

export function getFloorCoverage() {
  // @ts-ignore
  if (!world || crates.length === 0) return 0;
  
  const GROUND_HEIGHT = 60;
  // @ts-ignore
  const GAME_WIDTH = app.renderer.width;
  // @ts-ignore
  const GAME_HEIGHT = app.renderer.height;
  const WALL_THICKNESS = 60;
  const FLOOR_Y = GAME_HEIGHT - GROUND_HEIGHT;
  
  // Check how much of the floor is covered by boxes
  const floorSections = 20; // divide floor into sections
  const sectionWidth = (GAME_WIDTH - (WALL_THICKNESS * 2)) / floorSections;
  let coveredSections = 0;
  
  for (let i = 0; i < floorSections; i++) {
    const sectionX = WALL_THICKNESS + (i * sectionWidth);
    // @ts-ignore
    const sectionCenter = sectionX + sectionWidth / 2;
    
    // Check if any crate is near the floor in this section
    // @ts-ignore
    for (const crate of crates) {
      if (crate.body.position.y > FLOOR_Y - 100 && 
          crate.body.position.x > sectionX && 
          crate.body.position.x < sectionX + sectionWidth) {
        coveredSections++;
        break;
      }
    }
  }
  
  return coveredSections / floorSections;
}

export function clearBottomRow() {
  // @ts-ignore
  if (!world) return 0;
  
  const GROUND_HEIGHT = 60;
  // @ts-ignore
  const GAME_HEIGHT = app.renderer.height;
  const FLOOR_Y = GAME_HEIGHT - GROUND_HEIGHT;
  
  // Find crates near the floor
  const cratesToRemove = [];
  // @ts-ignore
  for (const crate of crates) {
    if (crate.body.position.y > FLOOR_Y - 80) {
      cratesToRemove.push(crate);
    }
  }
  
  // Remove crates
  for (const crate of cratesToRemove) {
    // Remove from physics world
    World.remove(world, crate.body);
    
    // Remove sprite from stage
    if (crate.sprite && crate.sprite.parent) {
      crate.sprite.parent.removeChild(crate.sprite);
    }
    
    // Remove from crates array
    // @ts-ignore
    const index = crates.indexOf(crate);
    if (index > -1) {
      // @ts-ignore
      crates.splice(index, 1);
    }
  }
  
  return cratesToRemove.length;
}

export function clearAllBodies() {
  // @ts-ignore
  if (!world) return;
  
  // @ts-ignore
  for (const crate of crates) {
    // Remove from physics world
    World.remove(world, crate.body);
    
    // Remove sprite from stage
    if (crate.sprite && crate.sprite.parent) {
      crate.sprite.parent.removeChild(crate.sprite);
    }
  }
  
  crates = [];
}

export function removeOffScreenCrates() {
  // @ts-ignore
  if (!world) return;
  
  // @ts-ignore
  const GAME_HEIGHT = app.renderer.height;
  const CLEANUP_Y = GAME_HEIGHT + 200; // Remove crates 200px below canvas
  
  const cratesToRemove = [];
  // @ts-ignore
  for (const crate of crates) {
    if (crate.body.position.y > CLEANUP_Y) {
      cratesToRemove.push(crate);
    }
  }
  
  // Remove off-screen crates
  for (const crate of cratesToRemove) {
    World.remove(world, crate.body);
    
    if (crate.sprite && crate.sprite.parent) {
      crate.sprite.parent.removeChild(crate.sprite);
    }
    
    // @ts-ignore
    const index = crates.indexOf(crate);
    if (index > -1) {
      // @ts-ignore
      crates.splice(index, 1);
    }
  }
}

// Add these missing functions that are called in your Svelte component
export function getPhysicsDebugInfo() {
  // @ts-ignore
  const settledCrates = crates.filter(crate => {
    // Consider a crate settled if it's moving very slowly
    const velocity = Math.abs(crate.body.velocity.x) + Math.abs(crate.body.velocity.y);
    return velocity < 0.1;
  });
  
  // @ts-ignore
  const fallingCrates = crates.filter(crate => {
    const velocity = Math.abs(crate.body.velocity.x) + Math.abs(crate.body.velocity.y);
    return velocity >= 0.1;
  });
  
  return {
    totalCrates: crates.length,
    settledCrates: settledCrates.length,
    fallingCrates: fallingCrates.length
  };
}

// @ts-ignore
export function hasReachedTargetHeight(targetHeight) {
  const currentHeight = getCurrentStackHeight();
  return currentHeight >= targetHeight;
}

export function isGameOverCondition() {
  const floorCoverage = getFloorCoverage();
  // Game over if floor is more than 70% covered
  return floorCoverage > 0.7;
}

export function resetPhysics() {
  clearAllBodies();
  // Reset any other physics state if needed
}