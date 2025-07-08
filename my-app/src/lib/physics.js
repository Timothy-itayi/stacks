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
const PARTICLE_COUNT = 20;
const EXPLOSION_FORCE = 0.003;
const EXPLOSION_RADIUS = 120;

// Chain reaction tracking
let chainReactionCount = 0;
let lastExplosionTime = 0;
let lastChainSize = 0;
const CHAIN_REACTION_WINDOW = 600;
const MAX_PARTICLES = 200; // Limit total particles
const MAX_CRATES = 100; // Limit total crates

// Track the currently selected explosive block
let selectedExplosiveBlock = null;

// Block properties
const BLOCK_PROPERTIES = {
  dirt: {
    density: 0.001,
    restitution: 0.1,
    friction: 0.6,
    frictionAir: 0.015,
    color: 0x96CEB4
  },
  explosive: {
    density: 0.0012,
    restitution: 0.08,
    friction: 0.7,
    frictionAir: 0.02,
    color: 0xFF4500
  },
  stone: {
    density: 0.002,
    restitution: 0.05,
    friction: 0.8,
    frictionAir: 0.01,
    color: 0x8B4513
  },
  dirt_top: {
    density: 0.0011,
    restitution: 0.1,
    friction: 0.65,
    frictionAir: 0.015,
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

// Add to the top with other constants
const FLOOR_SECTIONS = 30;
const BLOCK_WIDTH = 40;

// Track initial impact points of blocks that fell naturally
let floorImpacts = new Map(); // Maps block ID to impact position
let draggedBlocks = new Set(); // Track blocks that were dragged

// Track which blocks are touching the ground
let groundContacts = new Set();

// Add physics engine state tracking
let isPhysicsRunning = true;

// @ts-ignore
export async function initPhysics(pixiApp) {
  app = pixiApp;
  engine = Engine.create();
  world = engine.world;
  runner = Runner.create();
  isPhysicsRunning = true;

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

  // Track when blocks start being dragged
  Events.on(mouseConstraint, 'startdrag', (event) => {
    const body = event.body;
    if (body && body.blockType) {
      draggedBlocks.add(body.id);
      // Remove any existing impact data if block was dragged
      floorImpacts.delete(body.id);
    }
  });

  World.add(world, mouseConstraint);

  // Collision detection for initial impacts
  Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
      const { bodyA, bodyB } = pair;
      
      // Only record impacts for blocks that weren't dragged
      if (bodyA.label === 'ground' && bodyB.blockType && !draggedBlocks.has(bodyB.id) && !floorImpacts.has(bodyB.id)) {
        floorImpacts.set(bodyB.id, bodyB.position.x);
      } else if (bodyB.label === 'ground' && bodyA.blockType && !draggedBlocks.has(bodyA.id) && !floorImpacts.has(bodyA.id)) {
        floorImpacts.set(bodyA.id, bodyA.position.x);
      }
    });
  });

  // Collision detection
  Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
      const { bodyA, bodyB } = pair;
      
      // Check if one body is the ground and the other is a block
      if (bodyA.label === 'ground' && bodyB.blockType) {
        groundContacts.add(bodyB.id);
      } else if (bodyB.label === 'ground' && bodyA.blockType) {
        groundContacts.add(bodyA.id);
      }
    });
  });

  // Remove from ground contacts when collision ends
  Events.on(engine, 'collisionEnd', (event) => {
    event.pairs.forEach((pair) => {
      const { bodyA, bodyB } = pair;
      
      if (bodyA.label === 'ground' && bodyB.blockType) {
        groundContacts.delete(bodyB.id);
      } else if (bodyB.label === 'ground' && bodyA.blockType) {
        groundContacts.delete(bodyA.id);
      }
    });
  });

  Runner.run(runner, engine);
  crates = [];
  groundContacts = new Set();
  floorImpacts = new Map();
  draggedBlocks = new Set();

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

export function stopPhysics() {
  isPhysicsRunning = false;
  if (runner) {
    Runner.stop(runner);
  }
}

export function startPhysics() {
  isPhysicsRunning = true;
  if (engine && runner) {
    // Ensure runner is stopped before starting
    Runner.stop(runner);
    // Create new runner to ensure clean state
    runner = Runner.create();
    Runner.run(runner, engine);
  }
}

export function update() {
  // Don't update if physics is stopped
  if (!isPhysicsRunning) return;

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

  // Only measure settled blocks
  let highestSettledY = app.renderer.height;
  
  for (const crate of crates) {
    const velocity = Math.abs(crate.body.velocity.x) + Math.abs(crate.body.velocity.y);
    if (velocity < 0.5) { // Same threshold as getStackStatus
      if (crate.body.position.y < highestSettledY) {
        highestSettledY = crate.body.position.y;
      }
    }
  }

  return app.renderer.height - highestSettledY;
}

export function getStackStatus() {
  if (crates.length === 0) return { height: 0, dangerZone: false, settled: true };
  
  const GROUND_HEIGHT = 60;
  const GAME_HEIGHT = app.renderer.height;
  const DANGER_ZONE_HEIGHT = GAME_HEIGHT * 0.2; // Top 20% of screen is danger zone
  
  // Track settled blocks only
  let highestSettledY = GAME_HEIGHT;
  let hasMovingBlocks = false;
  
  for (const crate of crates) {
    const velocity = Math.abs(crate.body.velocity.x) + Math.abs(crate.body.velocity.y);
    const isSettled = velocity < 0.5; // Lower threshold for "settled"
    
    // Only consider settled blocks for height measurement
    if (isSettled) {
      if (crate.body.position.y < highestSettledY) {
        highestSettledY = crate.body.position.y;
      }
    } else {
      hasMovingBlocks = true;
    }
  }
  
  const heightFromBottom = GAME_HEIGHT - highestSettledY;
  const inDangerZone = highestSettledY < DANGER_ZONE_HEIGHT;
  
  return {
    height: heightFromBottom,
    dangerZone: inDangerZone,
    settled: !hasMovingBlocks
  };
}

export function getFloorSectionStates() {
  if (!world || crates.length === 0) {
    return Array(FLOOR_SECTIONS).fill({ hasSettledBlock: false });
  }
  
  const GAME_WIDTH = app.renderer.width;
  const WALL_THICKNESS = 60;
  const sectionWidth = (GAME_WIDTH - (WALL_THICKNESS * 2)) / FLOOR_SECTIONS;
  const sections = Array(FLOOR_SECTIONS).fill().map(() => ({ hasSettledBlock: false }));
  
  // Only use impact positions for blocks that fell naturally
  for (const crate of crates) {
    const impactX = floorImpacts.get(crate.body.id);
    if (impactX !== undefined && !draggedBlocks.has(crate.body.id)) {
      // Calculate which sections this block covers based on impact position
      const blockLeft = impactX - BLOCK_WIDTH/2;
      const blockRight = impactX + BLOCK_WIDTH/2;
      
      // Find all sections this block touches
      const startSection = Math.floor((blockLeft - WALL_THICKNESS) / sectionWidth);
      const endSection = Math.ceil((blockRight - WALL_THICKNESS) / sectionWidth);
      
      // Mark all covered sections
      for (let i = Math.max(0, startSection); i < Math.min(FLOOR_SECTIONS, endSection); i++) {
        sections[i].hasSettledBlock = true;
      }
    }
  }
  
  return sections;
}

export function getFloorCoverage() {
  if (!world || crates.length === 0) return 0;
  
  const GAME_WIDTH = app.renderer.width;
  const WALL_THICKNESS = 60;
  const sectionWidth = (GAME_WIDTH - (WALL_THICKNESS * 2)) / FLOOR_SECTIONS;
  const sections = new Array(FLOOR_SECTIONS).fill(false);
  
  // Only use impact positions for blocks that fell naturally
  for (const crate of crates) {
    const impactX = floorImpacts.get(crate.body.id);
    if (impactX !== undefined && !draggedBlocks.has(crate.body.id)) {
      // Calculate which sections this block covers based on impact position
      const blockLeft = impactX - BLOCK_WIDTH/2;
      const blockRight = impactX + BLOCK_WIDTH/2;
      
      // Find all sections this block touches
      const startSection = Math.floor((blockLeft - WALL_THICKNESS) / sectionWidth);
      const endSection = Math.ceil((blockRight - WALL_THICKNESS) / sectionWidth);
      
      // Mark all covered sections
      for (let i = Math.max(0, startSection); i < Math.min(FLOOR_SECTIONS, endSection); i++) {
        sections[i] = true;
      }
    }
  }
  
  const coveredSections = sections.filter(Boolean).length;
  return coveredSections / FLOOR_SECTIONS;
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
    groundContacts = new Set();
    floorImpacts = new Map();
    draggedBlocks = new Set();
    
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
  try {
    // Stop physics first
    stopPhysics();
    
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
    floorImpacts = new Map();
    draggedBlocks = new Set();
    groundContacts = new Set();
    
    // Reset state
    selectedExplosiveBlock = null;
    chainReactionCount = 0;
    lastExplosionTime = 0;

    // Reset engine and runner
    if (engine) {
      World.clear(world);
      Engine.clear(engine);
      
      // Re-add ground and walls since they were cleared
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
      World.add(world, [leftWall, rightWall]);
      
      // Reset engine timing
      engine.timing.timestamp = 0;
      engine.timing.lastDelta = 0;
      engine.timing.lastElapsed = 0;
      
      // Reset gravity
      engine.gravity.x = 0;
      engine.gravity.y = 1;
    }

    // Create new runner if needed
    if (!runner || !runner.enabled) {
      if (runner) {
        Runner.stop(runner);
      }
      runner = Runner.create();
    }

  } catch (error) {
    console.error('Reset physics error:', error);
  }
}

export function getLastChainReactionSize() {
  return lastChainSize;
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
    
    // Store the chain size for scoring
    lastChainSize = chainReactionCount;
    
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

    // Remove tracking data
    floorImpacts.delete(body.id);
    draggedBlocks.delete(body.id);
  } catch (error) {
    console.error('Block removal error:', error);
  }
}