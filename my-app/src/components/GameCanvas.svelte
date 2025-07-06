<script>
  import { onMount, onDestroy } from 'svelte';
  import { Application, Graphics } from 'pixi.js';
  import * as physics from '../lib/physics.js';
  import { GameLoop } from '../lib/GameLoop.js';

  // @ts-ignore
  let container;
  let currentHeight = 0;
  let settledHeight = 0; // New: track only settled crates
  // @ts-ignore
  let gameLoop;
  let app;
  
  // Game state
  let gameState = 'playing';
  let currentWave = 1;
  let score = 0;
  let timeElapsed = 0;
  let floorCoverage = 0;
  let nextDropIn = 0;
  
  // Debug info
  let debugInfo = {
    totalCrates: 0,
    settledCrates: 0,
    fallingCrates: 0
  };
  
  const targetHeight = 30;
  
  // Game config
  const GAME_CONFIG = {
    gameWidth: 640,
    gameHeight: 780,
    wallThickness: 60,
    groundHeight: 60,
    targetHeight: targetHeight
  };

  onMount(async () => {
    const { gameWidth: GAME_WIDTH, gameHeight: GAME_HEIGHT, wallThickness: WALL_THICKNESS, groundHeight: GROUND_HEIGHT } = GAME_CONFIG;

    app = new Application();
    await app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x18181b // darker, minimal bg (Tailwind gray-900)
    });

    // @ts-ignore
    container.appendChild(app.canvas);

    await physics.loadAssets();
    await physics.initPhysics(app);

    // Ground visual
    const ground = new Graphics();
    ground.beginFill(0x27272a); // Tailwind gray-800
    ground.drawRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);
    ground.endFill();
    ground.lineStyle(1, 0x3f3f46); // Tailwind gray-700 thin line
    ground.moveTo(0, GAME_HEIGHT - GROUND_HEIGHT);
    ground.lineTo(GAME_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);
    app.stage.addChild(ground);

    // Side wall visuals
    const leftWall = new Graphics();
    leftWall.beginFill(0x27272a);
    leftWall.drawRect(0, 0, WALL_THICKNESS, GAME_HEIGHT);
    leftWall.endFill();
    app.stage.addChild(leftWall);

    const rightWall = new Graphics();
    rightWall.beginFill(0x27272a);
    rightWall.drawRect(GAME_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, GAME_HEIGHT);
    rightWall.endFill();
    app.stage.addChild(rightWall);

    // Initialize game loop
    gameLoop = new GameLoop(physics, GAME_CONFIG);
    
    // Set up event listeners
    // @ts-ignore
    gameLoop.onGameStateChange = (newState) => {
      gameState = newState;
    };
    
    // @ts-ignore
    gameLoop.onWaveChange = (wave) => {
      currentWave = wave;
    };
    
    // @ts-ignore
    gameLoop.onScoreChange = (newScore) => {
      score = newScore;
    };

    // Create initial crates for demo
    // @ts-ignore
    physics.createCrate(200, 50, 'block');
    // @ts-ignore
    physics.createCrate(300, 0, 'block00');
    // @ts-ignore
    physics.createCrate(400, 100, 'block01');

    // Start the game loop
    gameLoop.start();

    app.ticker.add((delta) => {
      physics.update();
      // @ts-ignore
      gameLoop.update(delta);
      
      // Update UI state with enhanced physics info
      // @ts-ignore
      const state = gameLoop.getGameState();
      
      // Get physics debug info
      // @ts-ignore
      debugInfo = physics.getPhysicsDebugInfo();
      
      // Only use settled crates for height calculation
      settledHeight = physics.getCurrentStackHeight();
      currentHeight = settledHeight; // Use settled height for display
      
      timeElapsed = state.timeElapsed;
      floorCoverage = physics.getFloorCoverage(); // Use physics calculation
      nextDropIn = Math.ceil(state.nextDropIn / 1000);
      
      // Check win condition only with settled crates
      // @ts-ignore
      if (physics.hasReachedTargetHeight(targetHeight) && gameState === 'playing') {
        gameState = 'won';
        // @ts-ignore
        gameLoop.onGameStateChange('won');
      }
      
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
    // @ts-ignore
    if (gameLoop) {
      gameLoop.destroy();
    }
  });

  // Game actions
  function resetGame() {
    // @ts-ignore
    physics.resetPhysics();
    // @ts-ignore
    gameLoop.reset();
    currentHeight = 0;
    settledHeight = 0;
    gameState = 'playing';
  }

  function pauseGame() {
    if (gameState === 'playing') {
      // @ts-ignore
      gameLoop.pause();
    } else if (gameState === 'paused') {
      // @ts-ignore
      gameLoop.resume();
    }
  }

  function clearBottomRow() {
    const removedCount = physics.clearBottomRow();
    // @ts-ignore
    gameLoop.addScore(removedCount * 10); // Bonus points for cleared crates
  }

  function slowTime() {
    // @ts-ignore
    gameLoop.slowTime();
  }

  function dropCrate() {
    // Manual crate drop for testing
    const x = GAME_CONFIG.wallThickness + Math.random() * (GAME_CONFIG.gameWidth - GAME_CONFIG.wallThickness * 2);
    // @ts-ignore
    physics.createCrate(x, 50, 'block');
  }

  // Reactive statements for game state
  $: progressPercent = (settledHeight / targetHeight) * 100;
  $: floorCoveragePercent = floorCoverage * 100;
  $: isGameOver = gameState === 'gameOver';
  $: isWon = gameState === 'won';
  $: isPaused = gameState === 'paused';
</script>

<!-- Layout -->
<div class="min-h-screen flex flex-col justify-end items-center pb-5 relative bg-gray-900">
  <!-- Canvas container: subtle border, softer rounded corners, subtle shadow -->
  <div
    bind:this={container}
    class="w-[640px] h-[780px] rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.6)] border border-gray-700"
  ></div>

  <!-- HUD top-left: cleaner with reduced padding, smaller font, translucent background -->
  <div class="absolute top-4 left-4 bg-black/50 text-gray-100 rounded-xl p-3 shadow-lg w-60 space-y-2 font-sans select-none">
    <h1 class="text-lg font-semibold flex items-center gap-2 tracking-wide">🪵 Crate Stacker</h1>

    <div class="flex items-center justify-between text-sm font-medium">
      <span>Height:</span>
      <span class="text-lg font-bold">{settledHeight.toFixed(1)} m</span>
    </div>

    <div class="space-y-1">
      <div class="flex justify-between text-xs text-gray-300">
        <span>Goal</span>
        <span>{targetHeight} m</span>
      </div>
      <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          class="h-full bg-green-400 transition-all duration-300"
          style="width: {Math.min(progressPercent, 100)}%"
        ></div>
      </div>
    </div>

    <div class="flex items-center justify-between text-sm font-medium">
      <span>Wave:</span>
      <span class="text-lg font-bold">{currentWave}</span>
    </div>

    <div class="flex items-center justify-between text-sm font-medium">
      <span>Score:</span>
      <span class="text-lg font-bold">{score}</span>
    </div>

    <!-- Debug info -->
    <div class="text-xs text-gray-400 border-t border-gray-600 pt-2">
      <div class="flex justify-between">
        <span>Settled:</span>
        <span>{debugInfo.settledCrates}</span>
      </div>
      <div class="flex justify-between">
        <span>Falling:</span>
        <span>{debugInfo.fallingCrates}</span>
      </div>
      <div class="flex justify-between">
        <span>Total:</span>
        <span>{debugInfo.totalCrates}</span>
      </div>
    </div>
  </div>

  <!-- HUD top-right: Game status and controls -->
  <div class="absolute top-4 right-4 bg-black/50 text-gray-100 rounded-xl p-3 shadow-lg w-60 space-y-2 font-sans select-none">
    <div class="flex items-center justify-between text-sm font-medium">
      <span>Time:</span>
      <span class="text-lg font-bold">{timeElapsed.toFixed(0)}s</span>
    </div>

    <div class="flex items-center justify-between text-sm font-medium">
      <span>Next Drop:</span>
      <span class="text-lg font-bold">{nextDropIn}s</span>
    </div>

    <div class="space-y-1">
      <div class="flex justify-between text-xs text-gray-300">
        <span>Floor Coverage</span>
        <span>{floorCoveragePercent.toFixed(0)}%</span>
      </div>
      <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          class="h-full transition-all duration-300"
          class:bg-red-500={floorCoveragePercent > 60}
          class:bg-yellow-500={floorCoveragePercent > 40 && floorCoveragePercent <= 60}
          class:bg-green-400={floorCoveragePercent <= 40}
          style="width: {Math.min(floorCoveragePercent, 100)}%"
        ></div>
      </div>
    </div>

    <div class="flex gap-2">
      <button
        on:click={pauseGame}
        class="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>
      <button
        on:click={resetGame}
        class="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
      >
        Reset
      </button>
    </div>
  </div>

  <!-- Power-ups and testing panel -->
  <div class="absolute bottom-4 left-4 bg-black/50 text-gray-100 rounded-xl p-3 shadow-lg w-60 space-y-2 font-sans select-none">
    <h2 class="text-sm font-semibold">Power-ups</h2>
    
    <button
      on:click={clearBottomRow}
      disabled={score < 50}
      class="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
    >
      Clear Bottom Row (50 pts)
    </button>
    
    <button
      on:click={slowTime}
      disabled={score < 30}
      class="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
    >
      Slow Time (30 pts)
    </button>

    <!-- Test button -->
    <button
      on:click={dropCrate}
      class="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg transition-colors"
    >
      Drop Test Crate
    </button>
  </div>

  <!-- Game Over Modal -->
  {#if isGameOver}
    <div class="absolute inset-0 bg-black/70 flex items-center justify-center">
      <div class="bg-gray-800 text-white p-8 rounded-xl shadow-2xl text-center max-w-md">
        <h2 class="text-3xl font-bold mb-4 text-red-400">Game Over!</h2>
        <p class="text-lg mb-2">Floor got too crowded!</p>
        <p class="text-sm text-gray-300 mb-4">Final Score: <span class="font-bold">{score}</span></p>
        <p class="text-sm text-gray-300 mb-4">Final Height: <span class="font-bold">{settledHeight.toFixed(1)}m</span></p>
        <p class="text-sm text-gray-300 mb-6">Wave: <span class="font-bold">{currentWave}</span> | Time: <span class="font-bold">{timeElapsed.toFixed(0)}s</span></p>
        <button
          on:click={resetGame}
          class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  {/if}

  <!-- Victory Modal -->
  {#if isWon}
    <div class="absolute inset-0 bg-black/70 flex items-center justify-center">
      <div class="bg-gray-800 text-white p-8 rounded-xl shadow-2xl text-center max-w-md">
        <h2 class="text-3xl font-bold mb-4 text-green-400">Victory!</h2>
        <p class="text-lg mb-2">You reached the target height!</p>
        <p class="text-sm text-gray-300 mb-4">Final Score: <span class="font-bold">{score}</span></p>
        <p class="text-sm text-gray-300 mb-4">Final Height: <span class="font-bold">{settledHeight.toFixed(1)}m</span></p>
        <p class="text-sm text-gray-300 mb-6">Wave: <span class="font-bold">{currentWave}</span> | Time: <span class="font-bold">{timeElapsed.toFixed(0)}s</span></p>
        <button
          on:click={resetGame}
          class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  {/if}

  <!-- Pause overlay -->
  {#if isPaused}
    <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
      <div class="bg-gray-800 text-white p-6 rounded-xl shadow-2xl text-center">
        <h2 class="text-2xl font-bold mb-4">Game Paused</h2>
        <button
          on:click={pauseGame}
          class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          Resume
        </button>
      </div>
    </div>
  {/if}
</div>