<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Application, Graphics } from 'pixi.js';
  import * as physics from '../lib/physics.js';
  import { GameLoop } from '../lib/gameloop.js';

  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  let container: HTMLDivElement;
  let currentHeight = 0;
  let settledHeight = 0; // New: track only settled crates
  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  let gameLoop: GameLoop;
  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  let app: Application;
  
  // Game state
  let gameState = 'playing';
  let currentWave = 1;
  let score = 0;
  let timeElapsed = 0;
  let floorCoverage = 0;
  let nextDropIn = 0;
  let detonationCooldown = 0;
  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  let chainMultiplier = 1;
  
  // Debug info
  let debugInfo = {
    totalCrates: 0,
    settledCrates: 0,
    fallingCrates: 0
  };
  
  // Game config
  const GAME_CONFIG = {
    gameWidth: 640,
    gameHeight: 780,
    wallThickness: 30,
    groundHeight: 30,
    maxFloorCoverage: 0.7 // 70% floor coverage is game over
  };

  onMount(async () => {
    const { gameWidth: GAME_WIDTH, gameHeight: GAME_HEIGHT, wallThickness: WALL_THICKNESS, groundHeight: GROUND_HEIGHT } = GAME_CONFIG;

    app = new Application();
    await app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x111111 // Darker, more minimal background
    });

    container.appendChild(app.canvas);

    await physics.loadAssets();
    await physics.initPhysics(app);

    // Ground visual - thinner
    const ground = new Graphics();
    ground.beginFill(0x222222); // Subtle dark gray
    ground.drawRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);
    ground.endFill();
    ground.lineStyle(1, 0x333333); // Subtle line
    ground.moveTo(0, GAME_HEIGHT - GROUND_HEIGHT);
    ground.lineTo(GAME_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);
    app.stage.addChild(ground);

    // Side wall visuals - thinner
    const leftWall = new Graphics();
    leftWall.beginFill(0x222222);
    leftWall.drawRect(0, 0, WALL_THICKNESS, GAME_HEIGHT);
    leftWall.endFill();
    app.stage.addChild(leftWall);

    const rightWall = new Graphics();
    rightWall.beginFill(0x222222);
    rightWall.drawRect(GAME_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, GAME_HEIGHT);
    rightWall.endFill();
    app.stage.addChild(rightWall);

    // Progress line - more subtle
    const progressLine = new Graphics();
    app.stage.addChild(progressLine);

    // Initialize game loop
    gameLoop = new GameLoop(physics, GAME_CONFIG);
    
    // Set up event listeners
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    gameLoop.onGameStateChange = (newState: string) => {
      gameState = newState;
    };
    
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    gameLoop.onWaveChange = (wave: number) => {
      currentWave = wave;
    };
    
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    gameLoop.onScoreChange = (newScore: number) => {
      score = newScore;
    };

    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    gameLoop.onCooldownChange = (cooldown: number) => {
      detonationCooldown = cooldown;
    };

    // Create initial crates for demo
    for (let i = 0; i < 3; i++) {
      const x = WALL_THICKNESS + Math.random() * (GAME_WIDTH - WALL_THICKNESS * 2);
      physics.createCrate(x, 50 + i * 60, 'explosive');
    }
    
    // Start the game loop
    gameLoop.start();

    app.ticker.add((delta) => {
      physics.update();
      gameLoop.update(delta);
      
      // Update UI state
      const state = gameLoop.getGameState();
      
      // Get physics debug info
      // @ts-ignore
      debugInfo = physics.getPhysicsDebugInfo();
      
      timeElapsed = state.timeElapsed;
      floorCoverage = physics.getFloorCoverage();
      nextDropIn = Math.ceil(state.nextDropIn / 1000);
      detonationCooldown = state.detonationCooldown;
      
      // Check game over condition
      // @ts-ignore
      if (physics.isGameOverCondition() && gameState === 'playing') {
        gameState = 'gameOver';
        // @ts-ignore
        gameLoop.onGameStateChange('gameOver');
      }
    });
  });

  onDestroy(() => {
    if (gameLoop) {
      gameLoop.destroy();
    }
  });

  // Game actions
  function resetGame() {
    physics.resetPhysics();
    gameLoop.reset();
    currentHeight = 0;
    settledHeight = 0;
    gameState = 'playing';
  }

  function pauseGame() {
    if (gameState === 'playing') {
      gameLoop.pause();
    } else if (gameState === 'paused') {
      gameLoop.resume();
    }
  }

  // @ts-ignore
  // @ts-ignore
  // @ts-ignore
  function handleCanvasClick(event: MouseEvent) {
    if (gameState !== 'playing') return;
    
    // Get click coordinates relative to canvas
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Try to detonate
    gameLoop.tryDetonate(x, y);
  }

  // Reactive statements for game state
  $: floorCoveragePercent = floorCoverage * 100;
  $: isGameOver = gameState === 'gameOver';
  $: isPaused = gameState === 'paused';
</script>

<!-- Layout - Minimalistic version -->
<div class="min-h-screen flex flex-col justify-end items-center pb-5 relative bg-neutral-900">
  <!-- Canvas container with click handler -->
  <div
    bind:this={container}
    class="w-[640px] h-[780px] border border-neutral-800 overflow-hidden relative"
    on:click={handleCanvasClick}
  ></div>

  <!-- HUD top-left: minimal design -->
  <div class="absolute top-4 left-4 bg-neutral-900/80 text-neutral-200 p-3 w-56 space-y-2 font-mono text-sm">
    <div class="flex items-center justify-between">
      <span class="text-neutral-400">Score</span>
      <span>{score}</span>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-neutral-400">Wave</span>
      <span>{currentWave}</span>
    </div>

    <div class="space-y-1">
      <div class="flex justify-between text-xs text-neutral-400">
        <span>Floor Space</span>
        <span>{floorCoveragePercent.toFixed(0)}%</span>
      </div>
      <div class="w-full h-1 bg-neutral-800">
        <div
          class="h-full transition-all duration-300"
          class:bg-emerald-500={floorCoveragePercent <= 40}
          class:bg-orange-500={floorCoveragePercent > 40 && floorCoveragePercent <= 60}
          class:bg-red-500={floorCoveragePercent > 60}
          style="width: {Math.min(floorCoveragePercent, 100)}%"
        ></div>
      </div>
    </div>
  </div>

  <!-- HUD top-right: minimal stats -->
  <div class="absolute top-4 right-4 bg-neutral-900/80 text-neutral-200 p-3 w-56 space-y-2 font-mono text-sm">
    <div class="flex items-center justify-between">
      <span class="text-neutral-400">Time</span>
      <span>{timeElapsed.toFixed(0)}s</span>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-neutral-400">Next Drop</span>
      <span>{nextDropIn}s</span>
    </div>

    <div class="flex gap-2 mt-2">
      <button
        on:click={pauseGame}
        class="flex-1 px-2 py-1 border border-neutral-700 hover:bg-neutral-800 text-xs transition-colors"
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>
      <button
        on:click={resetGame}
        class="flex-1 px-2 py-1 border border-neutral-700 hover:bg-neutral-800 text-xs transition-colors"
      >
        Reset
      </button>
    </div>
  </div>

  <!-- Detonation cooldown indicator -->
  <div class="absolute bottom-4 left-4 bg-neutral-900/80 text-neutral-200 p-3 w-56 space-y-2 font-mono text-sm">
    <h2 class="text-xs text-neutral-400">Detonation</h2>
    
    <div class="space-y-1">
      <div class="flex justify-between text-xs">
        <span>Status</span>
        <span class:text-emerald-500={detonationCooldown === 0} class:text-orange-500={detonationCooldown > 0}>
          {detonationCooldown === 0 ? 'Ready' : `Cooldown: ${detonationCooldown.toFixed(1)}s`}
        </span>
      </div>
      {#if detonationCooldown > 0}
        <div class="w-full h-1 bg-neutral-800">
          <div
            class="h-full bg-orange-500 transition-all duration-300"
            style="width: {Math.max(0, (1 - detonationCooldown / 5) * 100)}%"
          ></div>
        </div>
      {/if}
    </div>

    <div class="text-xs text-neutral-400 mt-2">
      <p>Click on an explosive block to detonate it and clear nearby blocks.</p>
    </div>
  </div>

  <!-- Game Over Modal -->
  {#if isGameOver}
    <div class="absolute inset-0 bg-black/90 flex items-center justify-center font-mono">
      <div class="bg-neutral-900 text-neutral-200 p-6 border border-neutral-800">
        <h2 class="text-xl mb-4">Game Over</h2>
        <p class="text-sm mb-2 text-neutral-400">Floor too crowded</p>
        <p class="text-sm mb-4">Final Score: {score}</p>
        <p class="text-sm mb-4">Waves Survived: {currentWave}</p>
        <button
          on:click={resetGame}
          class="w-full px-4 py-2 border border-neutral-700 hover:bg-neutral-800 text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  {/if}

  <!-- Pause overlay -->
  {#if isPaused}
    <div class="absolute inset-0 bg-black/90 flex items-center justify-center font-mono">
      <div class="bg-neutral-900 text-neutral-200 p-6 border border-neutral-800">
        <h2 class="text-xl mb-4">Paused</h2>
        <button
          on:click={pauseGame}
          class="w-full px-4 py-2 border border-neutral-700 hover:bg-neutral-800 text-sm transition-colors"
        >
          Resume
        </button>
      </div>
    </div>
  {/if}
</div>