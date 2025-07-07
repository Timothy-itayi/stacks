// @ts-nocheck
// lib/physics.js
import matter from 'matter-js';
import { Sprite, Assets, Graphics, ParticleContainer, Point } from 'pixi.js';

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
const BLOCK_ALIASES = ['dirt', 'explosive', 'stone', 'dirt_top'];

/** @type {Array<Particle>} */
let particles = [];
const PARTICLE_COUNT = 25;
const EXPLOSION_FORCE = 0.004;
const EXPLOSION_RADIUS = 150;

// Chain reaction tracking
let chainReactionCount = 0;
let lastExplosionTime = 0;
const CHAIN_REACTION_WINDOW = 800;
const MAX_PARTICLES = 200; // Limit total particles
const MAX_CRATES = 100; // Limit total crates

// Track the currently selected explosive block
let selectedExplosiveBlock = null;

// Block properties
const BLOCK_PROPERTIES = {
  dirt: {
    density: 0.001,
    restitution: 0.1,
    friction: 0.5,
    frictionAir: 0.02,
    color: 0x96CEB4
  },
  explosive: {
    density: 0.001,
    restitution: 0.1,
    friction: 0.5,
    frictionAir: 0.02,
    color: 0xFF4500
  },
  stone: {
    density: 0.002, // Heavier
    restitution: 0.05, // Less bouncy
    friction: 0.8, // More friction
    frictionAir: 0.01,
    color: 0x8B4513
  },
  dirt_top: {
    density: 0.001,
    restitution: 0.1,
    friction: 0.5,
    frictionAir: 0.02,
    color: 0x8B4513
  }
};

class Particle extends Graphics {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} angle
   * @param {number} speed
   * @param {number} color
   */
  constructor(x, y, angle, speed, color) {
    super();
    this.position.set(x, y);
    this.velocity = new Point(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
    this.alpha = 1;
    this.beginFill(color);
    this.circle(0, 0, 3);
    this.endFill();
  }

  update() {
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.velocity.y += 0.1; // gravity
    this.alpha *= 0.95; // fade out
    return this.alpha > 0.1;
  }
}

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
    restitution: 0.3,
    label: 'ground'
  });
  World.add(world, ground);

  // Walls
  const leftWall = Bodies.rectangle(wallThickness / 2, height / 2, wallThickness, height, {
    isStatic: true,
    label: 'wall'
  });
  const rightWall = Bodies.rectangle(width - wallThickness / 2, height / 2, wallThickness, height, {
    isStatic: true,
    label: 'wall'
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

  // Remove the old collision handler and add new one for basic collisions
  Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
      const { bodyA, bodyB } = pair;
      // Add any necessary collision handling here
      // But don't trigger explosions automatically
    });
  });

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
          { alias: 'dirt', src: '/assets/extra_dirt_detail.png' },
          { alias: 'explosive', src: '/assets/explosive.png' },
          { alias: 'stone', src: '/assets/detail_stone.png' },
          { alias: 'dirt_top', src: '/assets/extra_dirt_top.png' }
        ]
      }
    ]
  };
  
  try {
    console.log('Initializing assets with manifest:', manifest);
    await Assets.init({ manifest });
    console.log('Assets initialized, loading bundle...');
    await Assets.loadBundle('bricks');
    console.log('Assets loaded successfully');
    
    // Verify each texture loaded correctly
    const loadedTextures = manifest.bundles[0].assets.map(asset => {
      const texture = Assets.get(asset.alias);
      console.log(`Texture ${asset.alias}:`, texture ? 'loaded' : 'failed to load');
      return texture;
    });
    
    if (loadedTextures.some(texture => !texture)) {
      console.error('Some textures failed to load');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to load assets:', error);
    // Fallback: create colored rectangles if assets fail to load
    return false;
  }
}

/**
 * @param {number} width
 * @param {number} height
 * @param {string} alias
 * @returns {Graphics}
 */
function createFallbackSprite(width, height, alias) {
  const graphics = new Graphics();
  const properties = BLOCK_PROPERTIES[alias] || BLOCK_PROPERTIES.dirt;
  
  graphics.beginFill(properties.color);
  graphics.roundRect(-width/2, -height/2, width, height, 8);
  graphics.endFill();
  
  graphics.lineStyle(2, 0x000000, 0.3);
  graphics.roundRect(-width/2, -height/2, width, height, 8);
  
  return graphics;
}

/**
 * Creates a new block
 */
export function createCrate(x, y, alias = 'dirt') {
  // Safety check for max crates
  if (crates.length >= MAX_CRATES) {
    const oldestCrate = crates[0];
    removeBlock(oldestCrate.body);
  }

  // Validate block type
  if (!BLOCK_PROPERTIES[alias]) {
    console.warn(`Invalid block type: ${alias}, falling back to dirt`);
    alias = 'dirt';
  }

  const width = 40;
  const height = 40;
  const properties = BLOCK_PROPERTIES[alias];

  const body = Bodies.rectangle(x, y, width, height, {
    restitution: properties.restitution,
    friction: properties.friction,
    frictionAir: properties.frictionAir,
    density: properties.density
  });

  body.blockType = alias;
  body.isExploded = false;
  body.createdAt = Date.now();

  let sprite;
  try {
    const texture = Assets.get(alias);
    if (texture) {
      sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = width;
      sprite.height = height;
      
      // Add highlight effect for explosive blocks
      if (alias === 'explosive') {
        const highlight = new Graphics();
        highlight.lineStyle(2, 0xffff00, 0.5);
        highlight.drawRect(-width/2, -height/2, width, height);
        sprite.addChild(highlight);
        highlight.visible = false;
        sprite.highlight = highlight;
      }
    } else {
      throw new Error(`Texture ${alias} not found`);
    }
  } catch (error) {
    console.warn(`Failed to load texture ${alias}, using fallback`, error);
    sprite = createFallbackSprite(width, height, alias);
  }

  if (!sprite) return null;

  app.stage.addChild(sprite);
  body.sprite = sprite;

  const crateObj = { body, sprite };
  crates.push(crateObj);
  World.add(world, body);

  return crateObj;
}

export function update() {
  try {
    // Clean up invalid crates
    crates = crates.filter(crate => {
      if (!crate || !crate.body || !crate.sprite) {
        if (crate) {
          removeBlock(crate.body);
        }
        return false;
      }
      return true;
    });

    // Update valid crates
    crates.forEach(({ body, sprite }) => {
      if (body && sprite) {
        sprite.x = body.position.x;
        sprite.y = body.position.y;
        sprite.rotation = body.angle;
      }
    });

    // Limit and update particles
    while (particles.length > MAX_PARTICLES) {
      const oldestParticle = particles.shift();
      if (oldestParticle && oldestParticle.parent) {
        oldestParticle.parent.removeChild(oldestParticle);
      }
    }

    particles = particles.filter(particle => {
      if (!particle) return false;
      const alive = particle.update();
      if (!alive && particle.parent) {
        particle.parent.removeChild(particle);
      }
      return alive;
    });

    // Clean up off-screen crates
    removeOffScreenCrates();
  } catch (error) {
    console.error('Update error:', error);
  }
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
  try {
    // Make a copy of the array to avoid modification during iteration
    const cratesToRemove = [...crates];
    
    cratesToRemove.forEach(crate => {
      if (crate && crate.body) {
        removeBlock(crate.body);
      }
    });
    
    // Clear arrays
    crates = [];
    particles = [];
    
    // Reset state
    selectedExplosiveBlock = null;
    chainReactionCount = 0;
    lastExplosionTime = 0;
  } catch (error) {
    console.error('Clear bodies error:', error);
  }
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

/**
 * Trigger an explosion at the specified coordinates
 */
export function triggerExplosion(x, y) {
  try {
    const currentTime = Date.now();
    
    // Check if this is part of a chain reaction
    if (currentTime - lastExplosionTime < CHAIN_REACTION_WINDOW) {
      chainReactionCount++;
    } else {
      chainReactionCount = 1;
    }
    lastExplosionTime = currentTime;
    
    // Calculate multiplier based on chain reaction
    const multiplier = Math.min(chainReactionCount, 3);
    const particleCount = Math.min(
      PARTICLE_COUNT * (1 + (multiplier - 1) * 0.5),
      MAX_PARTICLES - particles.length
    );
    const explosionRadius = EXPLOSION_RADIUS * (1 + (multiplier - 1) * 0.1);
    
    // Create particles if space available
    if (particles.length < MAX_PARTICLES) {
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const speed = 1.5 + Math.random() * 2 * multiplier;
        const particle = new Particle(x, y, angle, speed, 0xFF4500);
        particles.push(particle);
        app.stage.addChild(particle);
      }
    }

    // Apply explosion force to nearby crates
    const affectedBlocks = new Set();
    const validCrates = crates.filter(crate => crate && crate.body && !crate.body.isExploded);
    
    validCrates.forEach(crate => {
      const dx = crate.body.position.x - x;
      const dy = crate.body.position.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < explosionRadius) {
        affectedBlocks.add(crate.body.id);
        
        // Apply force
        const forceMagnitude = EXPLOSION_FORCE * multiplier * Math.pow(1 - distance / explosionRadius, 2);
        const force = {
          x: (dx / distance) * forceMagnitude,
          y: (dy / distance) * forceMagnitude
        };
        
        try {
          Body.applyForce(crate.body, crate.body.position, force);
        } catch (error) {
          console.error('Force application error:', error);
        }
        
        // Remove affected blocks with delay based on distance
        setTimeout(() => {
          try {
            if (crate.body && !crate.body.isExploded) {
              crate.body.isExploded = true;
              removeBlock(crate.body);
            }
          } catch (error) {
            console.error('Block removal error:', error);
          }
        }, distance * 2);
      }
    });
    
    return multiplier;
  } catch (error) {
    console.error('Explosion error:', error);
    return 1;
  }
}

/**
 * Select an explosive block for detonation
 */
export function selectExplosiveBlock(x, y) {
  // Deselect previous block
  if (selectedExplosiveBlock && selectedExplosiveBlock.sprite.highlight) {
    selectedExplosiveBlock.sprite.highlight.visible = false;
  }
  
  // Find closest explosive block
  let closestBlock = null;
  let closestDistance = Infinity;
  
  crates.forEach(crate => {
    if (crate.body.blockType === 'explosive' && !crate.body.isExploded) {
      const dx = crate.body.position.x - x;
      const dy = crate.body.position.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < closestDistance && distance < 50) { // Within 50px radius
        closestBlock = crate;
        closestDistance = distance;
      }
    }
  });
  
  // Highlight selected block
  if (closestBlock && closestBlock.sprite.highlight) {
    closestBlock.sprite.highlight.visible = true;
    selectedExplosiveBlock = closestBlock;
    return true;
  }
  
  selectedExplosiveBlock = null;
  return false;
}

/**
 * Detonate the selected explosive block
 */
export function detonateSelectedBlock() {
  if (selectedExplosiveBlock && !selectedExplosiveBlock.body.isExploded) {
    const pos = selectedExplosiveBlock.body.position;
    triggerExplosion(pos.x, pos.y);
    selectedExplosiveBlock.body.isExploded = true;
    removeBlock(selectedExplosiveBlock.body);
    selectedExplosiveBlock = null;
    return true;
  }
  return false;
}

// Helper function to remove a block
function removeBlock(body) {
  if (!body) return;

  try {
    // Remove from physics world if still in world
    if (world.bodies.includes(body)) {
      World.remove(world, body);
    }
    
    // Remove sprite if it exists and has a parent
    if (body.sprite && body.sprite.parent) {
      body.sprite.parent.removeChild(body.sprite);
    }
    
    // Remove from crates array
    const index = crates.findIndex(crate => crate && crate.body === body);
    if (index > -1) {
      crates.splice(index, 1);
    }
  } catch (error) {
    console.error('Block removal error:', error);
  }
}