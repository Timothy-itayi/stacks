<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Application, Graphics } from 'pixi.js';
  import * as physics from '$lib/physics.js';
  import { GameLoop } from '$lib/gameLoop.js';

  let container: HTMLDivElement;
  let gameLoop: GameLoop;
  let app: Application;

  let currentGameState = 'playing';
  let currentWave = 1;
  let score = 0;
  let timeElapsed = 0;
  let fillLevel = 0;
  let detonationCooldown = 0;
  let gameOverReason = '';
  
  // Game config
  const GAME_CONFIG = {
    gameWidth: 700,
    gameHeight: 780,
    wallThickness: 30,
    groundHeight: 60
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
      currentGameState = newState;
      if (newState === 'gameOver') {
        gameOverReason = gameLoop.getGameState().gameOverReason || 'fill';
        physics.stopPhysics();
      }
    };
    
    gameLoop.onWaveChange = (wave: number) => {
      currentWave = wave;
    };
    
    gameLoop.onScoreChange = (newScore: number) => {
      score = newScore;
    };

    gameLoop.onCooldownChange = (cooldown: number) => {
      detonationCooldown = cooldown;
    };

    gameLoop.onTimeUpdate = (elapsed: number) => {
      timeElapsed = elapsed;
    };

    // Start the game loop first
    gameLoop.start();

    // Small delay to ensure physics is ready before creating initial blocks
    setTimeout(() => {
      if (currentGameState === 'playing') {
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
      if (currentGameState === 'playing') {
        physics.update();
        gameLoop.update(delta);
      }
      
      const state = gameLoop.getGameState();
      timeElapsed = state.timeElapsed;
      fillLevel = physics.getFillLevel();
      detonationCooldown = state.detonationCooldown;
      
      if ((physics.isGameOverCondition() || physics.wasProtectedBlockDestroyed()) && currentGameState === 'playing') {
        if (physics.wasProtectedBlockDestroyed()) {
          gameLoop.gameOverReason = 'protected';
        }
        gameLoop.endGame();
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
    
    currentGameState = 'playing';
    gameOverReason = '';

    // Create initial blocks with delay to ensure physics is ready
    setTimeout(() => {
      if (currentGameState === 'playing') {
        // Start physics engine
        physics.startPhysics();
        
        // Start game loop
        gameLoop.start();
      }
    }, 100);
  }

  function pauseGame() {
    if (currentGameState === 'playing') {
      gameLoop.pause();
    } else if (currentGameState === 'paused') {
      gameLoop.resume();
    }
  }

  // @ts-ignore
  function handleCanvasClick(event: MouseEvent) {
    if (currentGameState !== 'playing') return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    gameLoop.tryDetonate(x, y);
  }

  $: fillLevelPercent = fillLevel * 100;
  $: isGameOver = currentGameState === 'gameOver';
  $: isPaused = currentGameState === 'paused';
</script>

<!-- Layout - Minimalistic version -->
<div class="min-h-screen flex flex-col justify-end items-center pb-5 relative bg-neutral-900">
  <!-- Canvas container with click handler -->
  <div
    bind:this={container}
    class="w-[700px] h-[780px] border border-neutral-800 overflow-hidden relative"
    on:click={handleCanvasClick}
  >
  </div>

  <!-- Timer Display -->
  <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-900/80 text-amber-100 p-3 font-mono text-lg">
    <div class="flex items-center gap-2">
      <span class="text-amber-500/80">Time:</span>
      <span>{Math.floor(timeElapsed)}s</span>
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
        <span>Fill Level</span>
        <span>{fillLevelPercent.toFixed(0)}%</span>
      </div>
      <div class="w-full h-1 bg-neutral-800">
        <div
          class="h-full transition-all duration-300"
          class:bg-lime-600={fillLevelPercent <= 40}
          class:bg-amber-500={fillLevelPercent > 40 && fillLevelPercent <= 60}
          class:bg-red-500={fillLevelPercent > 60}
          style="width: {Math.min(fillLevelPercent, 100)}%"
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

  <!-- Credit -->
  <div class="absolute bottom-4 left-4 bg-neutral-900/80 text-amber-100 p-3 w-56 font-mono text-xs opacity-60">
    Made by <a href="https://www.timothyitayi.com" target="_blank" rel="noopener noreferrer" class="text-amber-300 hover:text-amber-100 transition-colors">Timothy</a>
  </div>

  <!-- Game Over Modal -->
  {#if isGameOver}
    <div class="absolute inset-0 bg-black/90 flex items-center justify-center font-mono" style="z-index: 50;">
      <div class="bg-neutral-950 p-8 border border-neutral-700 max-w-md w-[420px] shadow-2xl">
        <h2 class="text-2xl font-bold mb-3" class:text-red-500={gameOverReason === 'protected'} class:text-orange-400={gameOverReason !== 'protected'}>
          {gameOverReason === 'protected' ? 'Protected Block Destroyed!' : 'The Box is Full!'}
        </h2>
        <p class="text-neutral-300 mb-5 text-sm leading-relaxed">
          {#if gameOverReason === 'protected'}
            You caught a <span class="text-red-400 font-semibold">protected block</span> in an explosion. Watch your blast radius!
          {:else}
            You survived <span class="text-white font-semibold">{timeElapsed.toFixed(1)}s</span> before the blocks overwhelmed you.
          {/if}
        </p>
        
        <div class="space-y-3 mb-6">
          <div class="bg-neutral-800/80 border border-neutral-700 p-4 rounded">
            <p class="text-lg text-white mb-1">Final Score: <span class="text-cyan-400 font-bold text-xl">{score}</span></p>
            <div class="flex gap-6 text-neutral-400 text-sm">
              <p>Wave <span class="text-neutral-200">{currentWave}</span></p>
              <p>Survived: <span class="text-neutral-200">{timeElapsed.toFixed(1)}s</span></p>
            </div>
          </div>
        </div>

        <button
          on:click={resetGame}
          class="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 hover:border-neutral-500 text-white text-sm font-medium transition-colors rounded"
        >
          Play Again
        </button>
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