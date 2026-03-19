<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
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

  // New state
  let highScore = 0;
  let isNewHighScore = false;
  let blocksCleared = 0;
  let comboText = '';
  let comboVisible = false;
  let comboTimeout: ReturnType<typeof setTimeout>;
  let waveMilestone = 0;
  let waveMilestoneVisible = false;
  let waveMilestoneTimeout: ReturnType<typeof setTimeout>;
  let showTutorial = false;
  let confettiPieces: Array<{x: number; delay: number; color: string; size: number}> = [];

  // Check tutorial state (guarded for SSR)
  if (typeof window !== 'undefined') {
    try { if (!localStorage.getItem('stacks_tutorial_seen')) showTutorial = true; } catch(e) {}
  }
  
  const GAME_CONFIG = {
    gameWidth: 700,
    gameHeight: 780,
    wallThickness: 30,
    groundHeight: 60
  };

  function generateConfetti() {
    const colors = ['#FFD700', '#FF6347', '#00CED1', '#FF69B4', '#7B68EE', '#00FF7F'];
    confettiPieces = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      delay: Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6
    }));
  }

  // Keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    if (event.code === 'Space') {
      event.preventDefault();
      pauseGame();
    } else if (event.code === 'KeyR') {
      resetGame();
    }
  }

  onMount(async () => {
    const { gameWidth: GAME_WIDTH, gameHeight: GAME_HEIGHT, wallThickness: WALL_THICKNESS, groundHeight: GROUND_HEIGHT } = GAME_CONFIG;

    // Load high score
    try { highScore = parseInt(localStorage.getItem('stacks_high_score') || '0', 10); } catch(e) {}

    window.addEventListener('keydown', handleKeydown);

    app = new Application();
    await app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x111111
    });

    container.appendChild(app.canvas);

    await physics.loadAssets();
    await physics.initPhysics(app);

    // Ground visual
    const ground = new Graphics();
    ground.beginFill(0x8B8B8B);
    ground.drawRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);
    ground.endFill();
    ground.lineStyle(1, 0x787878, 0.3);
    const gridSize = 15;
    for (let x = 0; x < GAME_WIDTH; x += gridSize) {
      ground.moveTo(x, GAME_HEIGHT - GROUND_HEIGHT);
      ground.lineTo(x, GAME_HEIGHT);
    }
    for (let y = GAME_HEIGHT - GROUND_HEIGHT; y < GAME_HEIGHT; y += gridSize) {
      ground.moveTo(0, y);
      ground.lineTo(GAME_WIDTH, y);
    }
    ground.lineStyle(1, 0x696969, 0.2);
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = GAME_HEIGHT - GROUND_HEIGHT + Math.random() * GROUND_HEIGHT;
      ground.drawCircle(x, y, 1);
    }
    ground.lineStyle(2, 0x9A9A9A, 0.7);
    ground.moveTo(0, GAME_HEIGHT - GROUND_HEIGHT);
    ground.lineTo(GAME_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);
    app.stage.addChild(ground);

    // Side walls
    const leftWall = new Graphics();
    const stripeHeight = 60;
    const numStripes = Math.ceil(GAME_HEIGHT / stripeHeight);
    for (let i = 0; i < numStripes; i++) {
      leftWall.beginFill(i % 2 === 0 ? 0xFFD700 : 0x000000);
      leftWall.drawRect(0, i * stripeHeight, WALL_THICKNESS, stripeHeight);
      leftWall.endFill();
    }
    leftWall.lineStyle(2, 0x000000, 0.3);
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      leftWall.moveTo(0, y);
      leftWall.lineTo(WALL_THICKNESS, y + 20);
    }
    app.stage.addChild(leftWall);

    const rightWall = new Graphics();
    for (let i = 0; i < numStripes; i++) {
      rightWall.beginFill(i % 2 === 0 ? 0xFFD700 : 0x000000);
      rightWall.drawRect(GAME_WIDTH - WALL_THICKNESS, i * stripeHeight, WALL_THICKNESS, stripeHeight);
      rightWall.endFill();
    }
    rightWall.lineStyle(2, 0x000000, 0.3);
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      rightWall.moveTo(GAME_WIDTH - WALL_THICKNESS, y);
      rightWall.lineTo(GAME_WIDTH, y + 20);
    }
    app.stage.addChild(rightWall);

    const progressLine = new Graphics();
    app.stage.addChild(progressLine);

    // Initialize game loop
    gameLoop = new GameLoop(physics, GAME_CONFIG);
    
    gameLoop.onGameStateChange = (newState: string) => {
      currentGameState = newState;
      if (newState === 'gameOver') {
        const state = gameLoop.getGameState();
        gameOverReason = state.gameOverReason || 'fill';
        highScore = state.highScore;
        isNewHighScore = state.isNewHighScore;
        blocksCleared = state.blocksCleared;
        physics.stopPhysics();
        if (isNewHighScore) generateConfetti();
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

    gameLoop.onCombo = (blockCount: number) => {
      comboText = blockCount >= 4 ? `×${blockCount} BLAST!` : `×${blockCount} CHAIN!`;
      comboVisible = true;
      clearTimeout(comboTimeout);
      comboTimeout = setTimeout(() => { comboVisible = false; }, 1500);
    };

    gameLoop.onWaveMilestone = (wave: number) => {
      waveMilestone = wave;
      waveMilestoneVisible = true;
      clearTimeout(waveMilestoneTimeout);
      waveMilestoneTimeout = setTimeout(() => { waveMilestoneVisible = false; }, 2500);
    };

    gameLoop.start();

    setTimeout(() => {
      if (currentGameState === 'playing') {
        for (let i = 0; i < 3; i++) {
          const x = WALL_THICKNESS + Math.random() * (GAME_WIDTH - WALL_THICKNESS * 2);
          const normalBlocks = ['dirt', 'stone', 'dirt_top'];
          const blockType = normalBlocks[Math.floor(Math.random() * normalBlocks.length)];
          physics.createCrate(x, -100 - i * 60, blockType);
        }
      }
    }, 100);

    app.ticker.add((delta) => {
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
    if (gameLoop) gameLoop.destroy();
    if (typeof window !== 'undefined') window.removeEventListener('keydown', handleKeydown);
    clearTimeout(comboTimeout);
    clearTimeout(waveMilestoneTimeout);
  });

  function resetGame() {
    physics.stopPhysics();
    physics.resetPhysics();
    gameLoop.reset();
    
    currentGameState = 'playing';
    gameOverReason = '';
    isNewHighScore = false;
    blocksCleared = 0;
    confettiPieces = [];

    setTimeout(() => {
      if (currentGameState === 'playing') {
        physics.startPhysics();
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
    if (showTutorial) dismissTutorial();
    if (currentGameState !== 'playing') return;
    const rect = container.getBoundingClientRect();
    gameLoop.tryDetonate(event.clientX - rect.left, event.clientY - rect.top);
  }

  // Mobile touch support
  let touchStartPos: { x: number; y: number } | null = null;
  let touchStartTime = 0;

  function handleTouchStart(event: TouchEvent) {
    if (currentGameState !== 'playing') return;
    const touch = event.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    touchStartTime = Date.now();
  }

  function handleTouchEnd(event: TouchEvent) {
    if (showTutorial) dismissTutorial();
    if (currentGameState !== 'playing' || !touchStartPos) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartPos.x;
    const dy = touch.clientY - touchStartPos.y;
    if (Math.sqrt(dx * dx + dy * dy) < 15 && Date.now() - touchStartTime < 300) {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      gameLoop.tryDetonate(touch.clientX - rect.left, touch.clientY - rect.top);
    }
    touchStartPos = null;
  }

  function dismissTutorial() {
    showTutorial = false;
    try { localStorage.setItem('stacks_tutorial_seen', 'true'); } catch(e) {}
  }

  $: fillLevelPercent = fillLevel * 100;
  $: isGameOver = currentGameState === 'gameOver';
  $: isPaused = currentGameState === 'paused';
</script>

<div class="min-h-screen flex flex-col justify-end items-center pb-5 relative bg-neutral-900">
  <!-- Canvas -->
  <div
    bind:this={container}
    class="w-[700px] h-[780px] border border-neutral-800 overflow-hidden relative"
    on:click={handleCanvasClick}
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
  >
  </div>

  <!-- Timer -->
  <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-900/80 text-amber-100 p-3 font-mono text-lg">
    <div class="flex items-center gap-2">
      <span class="text-amber-500/80">Time:</span>
      <span>{Math.floor(timeElapsed)}s</span>
    </div>
  </div>

  <!-- HUD top-left -->
  <div class="absolute top-4 left-4 bg-neutral-900/80 text-amber-100 p-3 w-56 space-y-2 font-mono text-sm">
    <div class="flex items-center justify-between">
      <span class="text-amber-500/80">Score</span>
      <span>{score}</span>
    </div>
    <div class="flex items-center justify-between text-xs">
      <span class="text-amber-500/50">Best</span>
      <span class="text-amber-300/60">{highScore}</span>
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

    <div class="text-xs text-amber-300/70 mt-2 border-t border-amber-900/30 pt-2">
      Click on a <span class="text-[#8B4513]">dirt</span> block or <span class="text-[#32CD32]">grass-topped dirt</span> to destroy it. <span class="text-red-500">Explosive</span> blocks clear nearby blocks.
    </div>
    <div class="text-xs text-amber-500/40 border-t border-amber-900/20 pt-1">
      <span class="text-amber-300/50">Space</span> Pause · <span class="text-amber-300/50">R</span> Reset
    </div>
  </div>

  <!-- HUD top-right -->
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

  <!-- Combo Popup -->
  {#if comboVisible}
    <div
      class="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none font-mono text-center"
      style="z-index: 40;"
      in:fly={{ y: 30, duration: 250 }}
      out:fly={{ y: -40, duration: 500 }}
    >
      <span class="text-4xl font-black text-orange-400 drop-shadow-[0_0_20px_rgba(255,100,0,0.6)]">
        {comboText}
      </span>
    </div>
  {/if}

  <!-- Wave Milestone -->
  {#if waveMilestoneVisible}
    <div
      class="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none font-mono text-center"
      style="z-index: 40;"
      in:fly={{ y: -40, duration: 350 }}
      out:fade={{ duration: 600 }}
    >
      <div class="bg-amber-900/80 border border-amber-600 px-6 py-3 rounded">
        <p class="text-lg font-bold text-amber-200">Wave {waveMilestone} Cleared!</p>
        <p class="text-xs text-amber-400/80 mt-1">Blocks falling faster...</p>
      </div>
    </div>
  {/if}

  <!-- Tutorial Overlay (pointer-events: none so clicks pass through) -->
  {#if showTutorial && currentGameState === 'playing'}
    <div
      class="absolute inset-0 pointer-events-none flex items-center justify-center font-mono"
      style="z-index: 35;"
      transition:fade={{ duration: 300 }}
    >
      <div class="text-center mt-20">
        <div class="text-5xl mb-3 animate-bounce">👇</div>
        <div class="bg-black/70 px-6 py-3 rounded-lg">
          <p class="text-amber-200 text-lg font-bold">TAP a dirt block!</p>
          <p class="text-amber-400/70 text-xs mt-1">Click or tap to destroy blocks</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Game Over Modal -->
  {#if isGameOver}
    <div class="absolute inset-0 bg-black/90 flex items-center justify-center font-mono" style="z-index: 50;">
      <!-- Confetti layer -->
      {#if isNewHighScore}
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          {#each confettiPieces as piece}
            <div
              class="confetti-piece absolute"
              style="left: {piece.x}%; animation-delay: {piece.delay}s; background-color: {piece.color}; width: {piece.size}px; height: {piece.size}px;"
            ></div>
          {/each}
        </div>
      {/if}

      <div class="bg-neutral-950 p-8 border border-neutral-700 max-w-md w-[420px] shadow-2xl relative" in:fly={{ y: 30, duration: 350 }}>
        {#if isNewHighScore}
          <div class="text-center mb-4">
            <span class="text-yellow-400 text-sm font-bold tracking-widest uppercase animate-pulse">New Personal Best!</span>
          </div>
        {/if}

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
            <p class="text-lg text-white mb-2">
              Final Score: <span class="text-cyan-400 font-bold text-xl">{score}</span>
              {#if highScore > 0}
                <span class="text-neutral-500 text-sm ml-2">Best: {highScore}</span>
              {/if}
            </p>
            <div class="flex gap-6 text-neutral-400 text-sm">
              <p>Wave <span class="text-neutral-200">{currentWave}</span></p>
              <p>Survived <span class="text-neutral-200">{timeElapsed.toFixed(1)}s</span></p>
              <p>Cleared <span class="text-neutral-200">{blocksCleared}</span></p>
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

  <!-- Pause Overlay -->
  {#if isPaused}
    <div class="absolute inset-0 bg-black/90 flex items-center justify-center font-mono" style="z-index: 50;" transition:fade={{ duration: 200 }}>
      <div class="bg-neutral-900 text-amber-100 p-6 border border-amber-900/30 w-64 space-y-3">
        <h2 class="text-xl mb-2 text-center">Paused</h2>
        <button
          on:click={pauseGame}
          class="w-full px-4 py-2 border border-amber-900/30 hover:bg-amber-900/20 text-sm transition-colors"
        >
          Resume
        </button>
        <button
          on:click={resetGame}
          class="w-full px-4 py-2 border border-red-900/30 hover:bg-red-900/20 text-sm transition-colors text-red-300"
        >
          Restart
        </button>
        <p class="text-center text-xs text-amber-500/40 pt-2 border-t border-amber-900/20">
          <span class="text-amber-300/50">Space</span> Resume · <span class="text-amber-300/50">R</span> Restart
        </p>
      </div>
    </div>
  {/if}
</div>

<style>
  .confetti-piece {
    position: absolute;
    top: -10px;
    border-radius: 2px;
    animation: confetti-fall 3.5s ease-in forwards;
  }

  @keyframes confetti-fall {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(720deg);
      opacity: 0;
    }
  }
</style>
