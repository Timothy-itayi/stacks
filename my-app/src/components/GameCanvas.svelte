<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Application, Graphics } from 'pixi.js';
  import * as physics from '$lib/physics.js';
  import { GameLoop } from '$lib/gameloop.js';
  import { gameState } from '$lib/gameState.js';

  interface ExplosionEvent {
    x: number;
    y: number;
    time: number;
  }

  interface DebugState {
    lastScoreUpdate: number;
    lastGameState: string;
    lastExplosion: ExplosionEvent | null;
    blockRemovals: Array<{ id: string; time: number }>;
    gameOverReason: string;
    physicsActive: boolean;
  }

  let container: HTMLDivElement;
  let currentHeight = 0;
  let settledHeight = 0; // New: track only settled crates
  let gameLoop: GameLoop;
  let app: Application;
  
  // Game state
  let gameState = 'playing';
  let currentWave = 1;
  let score = 0;
  let timeElapsed = 0;
  let floorCoverage = 0;
  let nextDropIn = 0;
  let detonationCooldown = 0;
  let chainMultiplier = 1;
  let timeRemaining = 60;
  
  // Debug info
  let debugInfo = {
    totalCrates: 0,
    settledCrates: 0,
    fallingCrates: 0
  };
  
  // Enhanced debug state
  let debugState: DebugState = {
    lastScoreUpdate: 0,
    lastGameState: '',
    lastExplosion: null,
    blockRemovals: [],
    gameOverReason: '',
    physicsActive: true
  };
  
  // Debug floor sections
  interface FloorSection {
    hasSettledBlock: boolean;
  }
  let floorSections: FloorSection[] = [];
  let showDebug = false; // Toggle for debug visualization
  
  // Game config
  const GAME_CONFIG = {
    gameWidth: 700,
    gameHeight: 780,
    wallThickness: 30,
    groundHeight: 60,
    maxFloorCoverage: 1.0 // 100% floor coverage is game over
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

    // Ground visual - enhanced with pattern
    const ground = new Graphics();
    
    // Main floor fill - concrete color
    ground.beginFill(0x8B8B8B); // Medium concrete gray
    ground.drawRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);
    ground.endFill();
    
    // Add subtle concrete pattern
    ground.lineStyle(1, 0x787878, 0.3); // Darker lines for concrete texture
    const gridSize = 15; // Smaller grid for more detailed concrete texture
    for (let x = 0; x < GAME_WIDTH; x += gridSize) {
      ground.moveTo(x, GAME_HEIGHT - GROUND_HEIGHT);
      ground.lineTo(x, GAME_HEIGHT);
    }
    for (let y = GAME_HEIGHT - GROUND_HEIGHT; y < GAME_HEIGHT; y += gridSize) {
      ground.moveTo(0, y);
      ground.lineTo(GAME_WIDTH, y);
    }
    
    // Add some random dots for concrete texture
    ground.lineStyle(1, 0x696969, 0.2);
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = GAME_HEIGHT - GROUND_HEIGHT + Math.random() * GROUND_HEIGHT;
      ground.drawCircle(x, y, 1);
    }
    
    // Top edge highlight
    ground.lineStyle(2, 0x9A9A9A, 0.7);
    ground.moveTo(0, GAME_HEIGHT - GROUND_HEIGHT);
    ground.lineTo(GAME_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);
    
    app.stage.addChild(ground);

    // Side wall visuals - construction theme
    const leftWall = new Graphics();
    // Construction barrier pattern - yellow and black stripes
    const stripeHeight = 60;
    const numStripes = Math.ceil(GAME_HEIGHT / stripeHeight);
    
    for (let i = 0; i < numStripes; i++) {
      leftWall.beginFill(i % 2 === 0 ? 0xFFD700 : 0x000000); // Alternating yellow and black
      leftWall.drawRect(0, i * stripeHeight, WALL_THICKNESS, stripeHeight);
      leftWall.endFill();
    }
    
    // Add warning pattern overlay
    leftWall.lineStyle(2, 0x000000, 0.3);
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      leftWall.moveTo(0, y);
      leftWall.lineTo(WALL_THICKNESS, y + 20);
    }
    
    app.stage.addChild(leftWall);

    const rightWall = new Graphics();
    // Mirror the construction barrier pattern
    for (let i = 0; i < numStripes; i++) {
      rightWall.beginFill(i % 2 === 0 ? 0xFFD700 : 0x000000); // Alternating yellow and black
      rightWall.drawRect(GAME_WIDTH - WALL_THICKNESS, i * stripeHeight, WALL_THICKNESS, stripeHeight);
      rightWall.endFill();
    }
    
    // Add warning pattern overlay
    rightWall.lineStyle(2, 0x000000, 0.3);
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      rightWall.moveTo(GAME_WIDTH - WALL_THICKNESS, y);
      rightWall.lineTo(GAME_WIDTH, y + 20);
    }
    
    app.stage.addChild(rightWall);

    // Progress line - more subtle
    const progressLine = new Graphics();
    app.stage.addChild(progressLine);

    // Initialize game loop
    gameLoop = new GameLoop(physics, GAME_CONFIG);
    
    // Set up event listeners
    gameLoop.onGameStateChange = (newState: string) => {
      debugState.lastGameState = gameState;
      gameState = newState;
      if (newState === 'gameOver') {
        const coverage = physics.getFloorCoverage();
        debugState.gameOverReason = timeRemaining <= 0 ? 
          "Time's Up!" : 
          `Floor Coverage: ${(coverage * 100).toFixed(1)}%`;
        debugState.physicsActive = false;
        physics.stopPhysics();
      }
      debugState = debugState;
    };
    
    gameLoop.onWaveChange = (wave: number) => {
      currentWave = wave;
    };
    
    gameLoop.onScoreChange = (newScore: number) => {
      debugState.lastScoreUpdate = Date.now();
      score = newScore;
      debugState = debugState;
    };

    gameLoop.onCooldownChange = (cooldown: number) => {
      detonationCooldown = cooldown;
    };

    gameLoop.onTimeUpdate = (remaining: number) => {
      timeRemaining = remaining;
    };

    // Start the game loop first
    gameLoop.start();

    // Small delay to ensure physics is ready before creating initial blocks
    setTimeout(() => {
      if (gameState === 'playing') {
        // Create initial crates for demo with proper positioning
        for (let i = 0; i < 3; i++) {
          const x = WALL_THICKNESS + Math.random() * (GAME_WIDTH - WALL_THICKNESS * 2);
          const normalBlocks = ['dirt', 'stone', 'dirt_top'];
          const blockType = normalBlocks[Math.floor(Math.random() * normalBlocks.length)];
          // Position blocks higher up initially
          physics.createCrate(x, -100 - i * 60, blockType);
        }
      }
    }, 100);

    app.ticker.add((delta) => {
      // Only update physics if game is not over
      if (gameState === 'playing') {
        physics.update();
        gameLoop.update(delta);
      }
      
      // Update UI state
      const state = gameLoop.getGameState();
      
      // Get physics debug info
      debugInfo = physics.getPhysicsDebugInfo();
      
      // Update floor section debug info
      if (showDebug) {
        floorSections = physics.getFloorSectionStates();
      }
      
      timeElapsed = state.timeElapsed;
      const coverage = physics.getFloorCoverage();
      floorCoverage = coverage;
      detonationCooldown = state.detonationCooldown;
      
      // Check game over condition
      if (physics.isGameOverCondition() && gameState === 'playing') {
        gameState = 'gameOver';
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
    // First stop physics and clear everything
    physics.stopPhysics();
    physics.resetPhysics();
    
    // Reset game loop
    gameLoop.reset();
    
    // Reset local state
    currentHeight = 0;
    settledHeight = 0;
    gameState = 'playing';
    debugState.physicsActive = true;
    
    // Create initial blocks with delay to ensure physics is ready
    setTimeout(() => {
      if (gameState === 'playing') {
        // Start physics engine
        physics.startPhysics();
        
        // Start game loop
        gameLoop.start();
      }
    }, 100);
  }

  function pauseGame() {
    if (gameState === 'playing') {
      gameLoop.pause();
    } else if (gameState === 'paused') {
      gameLoop.resume();
    }
  }

  // @ts-ignore
  function handleCanvasClick(event: MouseEvent) {
    if (gameState !== 'playing') return;
    
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const result = gameLoop.tryDetonate(x, y);
    if (result) {
      // Track successful interaction
      handleExplosion(x, y);
    }
  }

  // Reactive statements for game state
  $: floorCoveragePercent = floorCoverage * 100;
  $: isGameOver = gameState === 'gameOver';
  $: isPaused = gameState === 'paused';

  function toggleDebug() {
    showDebug = !showDebug;
  }

  function handleExplosion(x: number, y: number) {
    debugState.lastExplosion = {
      x,
      y,
      time: Date.now()
    };
    debugState = debugState;
  }

  // Track block removals
  function trackBlockRemoval(id: string) {
    debugState.blockRemovals.push({
      id,
      time: Date.now()
    });
    // Keep only last 10 removals
    if (debugState.blockRemovals.length > 10) {
      debugState.blockRemovals.shift();
    }
    debugState = debugState;
  }
</script>

<!-- Layout - Minimalistic version -->
<div class="min-h-screen flex flex-col justify-end items-center pb-5 relative bg-neutral-900">
  <!-- Canvas container with click handler -->
  <div
    bind:this={container}
    class="w-[700px] h-[780px] border border-neutral-800 overflow-hidden relative"
    on:click={handleCanvasClick}
  >
    <!-- Debug floor sections -->
    {#if showDebug}
      <div class="absolute bottom-0 left-0 right-0 flex" style="height: 100px;">
        {#each floorSections as section, i}
          <div 
            class="h-full border-r border-neutral-700 transition-colors duration-200"
            style="width: {100/15}%; background-color: {
              section.hasSettledBlock ? 'rgba(255, 0, 0, 0.3)' : 
              'rgba(0, 255, 0, 0.1)'
            }"
          >
            <div class="text-xs text-white opacity-50 text-center">
              {i + 1}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Timer Display -->
  <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-900/80 text-amber-100 p-3 font-mono text-lg">
    <div class="flex items-center gap-2">
      <span class="text-amber-500/80">Time:</span>
      <span class:text-red-400={timeRemaining <= 10}>
        {Math.ceil(timeRemaining)}s
      </span>
    </div>
  </div>

  <!-- HUD top-left: minimal design -->
  <div class="absolute top-4 left-4 bg-neutral-900/80 text-amber-100 p-3 w-56 space-y-2 font-mono text-sm">
    <div class="flex items-center justify-between">
      <span class="text-amber-500/80">Score</span>
      <span>{score}</span>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-amber-500/80">Wave</span>
      <span>{currentWave}</span>
    </div>

    <div class="space-y-1">
      <div class="flex justify-between text-xs text-amber-500/80">
        <span>Floor Space</span>
        <span>{floorCoveragePercent.toFixed(0)}%</span>
      </div>
      <div class="w-full h-1 bg-neutral-800">
        <div
          class="h-full transition-all duration-300"
          class:bg-lime-600={floorCoveragePercent <= 40}
          class:bg-amber-500={floorCoveragePercent > 40 && floorCoveragePercent <= 60}
          class:bg-red-500={floorCoveragePercent > 60}
          style="width: {Math.min(floorCoveragePercent, 100)}%"
        ></div>
      </div>
    </div>

    <!-- Instructions -->
    <div class="text-xs text-amber-300/70 mt-2 border-t border-amber-900/30 pt-2">
      Click on a <span class="text-[#8B4513]">dirt</span> block or <span class="text-[#32CD32]">grass-topped dirt</span> to destroy it. <span class="text-red-500">Explosive</span> blocks clear nearby blocks.
    </div>
  </div>

  <!-- HUD top-right: minimal stats -->
  <div class="absolute top-4 right-4 bg-neutral-900/80 text-amber-100 p-3 w-56 space-y-2 font-mono text-sm">
    <div class="flex items-center justify-between">
      <span class="text-amber-500/80">Elapsed</span>
      <span>{timeElapsed.toFixed(0)}s</span>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-amber-500/80">Next Drop</span>
      <span>{nextDropIn}s</span>
    </div>

    <div class="flex gap-2 mt-2">
      <button
        on:click={pauseGame}
        class="flex-1 px-2 py-1 border border-amber-900/30 hover:bg-amber-900/20 text-xs transition-colors"
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>
      <button
        on:click={resetGame}
        class="flex-1 px-2 py-1 border border-amber-900/30 hover:bg-amber-900/20 text-xs transition-colors"
      >
        Reset
      </button>
    </div>
  </div>

  <!-- Debug Toggle Button -->
  <button
    on:click={() => showDebug = !showDebug}
    class="absolute bottom-4 right-4 px-3 py-1 bg-neutral-900/80 border border-amber-900/30 text-amber-100 text-xs hover:bg-amber-900/20"
  >
    {showDebug ? 'Hide Debug' : 'Show Debug'}
  </button>

  <!-- Credit -->
  <div class="absolute bottom-4 left-4 bg-neutral-900/80 text-amber-100 p-3 w-56 font-mono text-xs opacity-60">
    Made by <a href="https://www.timothyitayi.com" target="_blank" rel="noopener noreferrer" class="text-amber-300 hover:text-amber-100 transition-colors">Timothy</a>
  </div>

  <!-- Enhanced Debug Panel -->
  {#if showDebug}
    <div class="absolute top-4 right-4 bg-neutral-900/90 text-neutral-200 p-4 font-mono text-xs space-y-2 border border-neutral-700 max-w-xs" style="z-index: 100;">
      <div class="flex justify-between items-center">
        <span>Debug Mode</span>
        <button
          on:click={() => showDebug = false}
          class="px-2 py-1 bg-neutral-800 hover:bg-neutral-700"
        >
          Close
        </button>
      </div>
      
      <div class="space-y-1">
        <div>Game State: {gameState}</div>
        <div>Previous State: {debugState.lastGameState}</div>
        <div class:text-red-400={!debugState.physicsActive}>Physics Active: {debugState.physicsActive ? 'Yes' : 'No'}</div>
        <div>Total Crates: {debugInfo.totalCrates}</div>
        <div>Settled: {debugInfo.settledCrates}</div>
        <div>Falling: {debugInfo.fallingCrates}</div>
        <div>Floor Coverage: {(floorCoverage * 100).toFixed(1)}%</div>
        
        {#if debugState.lastScoreUpdate}
          <div>Last Score Update: {((Date.now() - debugState.lastScoreUpdate) / 1000).toFixed(1)}s ago</div>
        {/if}
        
        {#if debugState.lastExplosion}
          <div>Last Explosion: {((Date.now() - debugState.lastExplosion.time) / 1000).toFixed(1)}s ago</div>
          <div>At: ({debugState.lastExplosion.x}, {debugState.lastExplosion.y})</div>
        {/if}

        {#if debugState.blockRemovals.length > 0}
          <div class="mt-2 pt-2 border-t border-neutral-700">
            <div class="mb-1">Recent Block Removals:</div>
            {#each debugState.blockRemovals.slice(-3) as removal}
              <div class="text-xs opacity-75">
                {((Date.now() - removal.time) / 1000).toFixed(1)}s ago
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Game Over Modal -->
  {#if isGameOver}
    <div class="absolute inset-0 bg-black/90 flex items-center justify-center font-mono" style="z-index: 50;">
      <div class="bg-neutral-900 text-amber-100 p-6 border border-amber-900/30 max-w-md">
        <h2 class="text-xl mb-2 text-amber-300">Well Played!</h2>
        <p class="text-amber-200/80 mb-4 text-sm">You kept clearing blocks until {debugState.gameOverReason === "Time's Up!" ? 'time ran out' : 'the demolition zone was full'}!</p>
        
        <div class="space-y-3 mb-4">
          <div class="bg-amber-900/20 p-3 rounded">
            <p class="text-lg mb-1">Final Score: <span class="text-amber-300">{score}</span></p>
            <div class="flex gap-4 text-amber-200/80">
              <p>Wave {currentWave}</p>
              <p>{timeElapsed.toFixed(1)}s</p>
            </div>
          </div>
          
          <!-- Stats box -->
          <div class="bg-amber-900/10 p-3 rounded text-sm">
            <p class="text-amber-300/90 mb-2">Demolition Stats</p>
            <div class="grid grid-cols-2 gap-2 text-xs text-amber-200/70">
              <div>Total Blocks: {debugInfo.totalCrates}</div>
              <div>Settled Blocks: {debugInfo.settledCrates}</div>
              <div>Zone Coverage: {(floorCoverage * 100).toFixed(1)}%</div>
              {#if debugState.lastExplosion}
                <div>Final Action: {((Date.now() - debugState.lastExplosion.time) / 1000).toFixed(1)}s ago</div>
              {/if}
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            on:click={resetGame}
            class="flex-1 px-4 py-2 border border-amber-900/30 hover:bg-amber-900/20 text-sm transition-colors"
          >
            Clear Again
          </button>
          <button
            on:click={() => showDebug = !showDebug}
            class="px-4 py-2 border border-amber-900/30 hover:bg-amber-900/20 text-sm transition-colors"
          >
            {showDebug ? 'Hide Stats' : 'Show Stats'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Pause overlay -->
  {#if isPaused}
    <div class="absolute inset-0 bg-black/90 flex items-center justify-center font-mono">
      <div class="bg-neutral-900 text-amber-100 p-6 border border-amber-900/30">
        <h2 class="text-xl mb-4">Paused</h2>
        <button
          on:click={pauseGame}
          class="w-full px-4 py-2 border border-amber-900/30 hover:bg-amber-900/20 text-sm transition-colors"
        >
          Resume
        </button>
      </div>
    </div>
  {/if}
</div>