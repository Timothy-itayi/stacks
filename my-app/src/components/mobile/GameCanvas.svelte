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

  if (typeof window !== 'undefined') {
    try { if (!localStorage.getItem('stacks_tutorial_seen')) showTutorial = true; } catch(e) {}
  }

  // Dynamic sizing based on viewport
  let screenW = 390;
  let screenH = 844;

  function getGameConfig() {
    const w = screenW;
    const wallThickness = Math.max(14, Math.round(20 * w / 390));
    const groundHeight = Math.max(30, Math.round(40 * w / 390));
    return {
      gameWidth: w,
      gameHeight: screenH,
      wallThickness,
      groundHeight
    };
  }

  function generateConfetti() {
    const colors = ['#FFD700', '#FF6347', '#00CED1', '#FF69B4', '#7B68EE', '#00FF7F'];
    confettiPieces = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      delay: Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6
    }));
  }

  onMount(async () => {
    screenW = window.innerWidth;
    screenH = window.innerHeight;

    try { highScore = parseInt(localStorage.getItem('stacks_high_score') || '0', 10); } catch(e) {}

    const config = getGameConfig();
    const { gameWidth: GW, gameHeight: GH, wallThickness: WT, groundHeight: GRND } = config;

    app = new Application();
    await app.init({
      width: GW,
      height: GH,
      backgroundColor: 0x111111
    });

    container.appendChild(app.canvas);

    await physics.loadAssets();
    await physics.initPhysics(app, { wallThickness: WT, groundHeight: GRND });

    // Ground visual
    const ground = new Graphics();
    ground.beginFill(0x8B8B8B);
    ground.drawRect(0, GH - GRND, GW, GRND);
    ground.endFill();
    ground.lineStyle(1, 0x787878, 0.3);
    const gridSize = 12;
    for (let x = 0; x < GW; x += gridSize) {
      ground.moveTo(x, GH - GRND);
      ground.lineTo(x, GH);
    }
    for (let y = GH - GRND; y < GH; y += gridSize) {
      ground.moveTo(0, y);
      ground.lineTo(GW, y);
    }
    ground.lineStyle(2, 0x9A9A9A, 0.7);
    ground.moveTo(0, GH - GRND);
    ground.lineTo(GW, GH - GRND);
    app.stage.addChild(ground);

    // Side walls — construction barrier pattern scaled to mobile wall thickness
    const stripeHeight = Math.max(30, Math.round(60 * WT / 30));
    const numStripes = Math.ceil(GH / stripeHeight);

    const leftWall = new Graphics();
    for (let i = 0; i < numStripes; i++) {
      leftWall.beginFill(i % 2 === 0 ? 0xFFD700 : 0x000000);
      leftWall.drawRect(0, i * stripeHeight, WT, stripeHeight);
      leftWall.endFill();
    }
    leftWall.lineStyle(1, 0x000000, 0.3);
    for (let y = 0; y < GH; y += stripeHeight / 1.5) {
      leftWall.moveTo(0, y);
      leftWall.lineTo(WT, y + stripeHeight / 3);
    }
    app.stage.addChild(leftWall);

    const rightWall = new Graphics();
    for (let i = 0; i < numStripes; i++) {
      rightWall.beginFill(i % 2 === 0 ? 0xFFD700 : 0x000000);
      rightWall.drawRect(GW - WT, i * stripeHeight, WT, stripeHeight);
      rightWall.endFill();
    }
    rightWall.lineStyle(1, 0x000000, 0.3);
    for (let y = 0; y < GH; y += stripeHeight / 1.5) {
      rightWall.moveTo(GW - WT, y);
      rightWall.lineTo(GW, y + stripeHeight / 3);
    }
    app.stage.addChild(rightWall);

    // Game loop init
    gameLoop = new GameLoop(physics, config);

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

    gameLoop.onWaveChange = (wave: number) => { currentWave = wave; };
    gameLoop.onScoreChange = (newScore: number) => { score = newScore; };
    gameLoop.onCooldownChange = (cooldown: number) => { detonationCooldown = cooldown; };
    gameLoop.onTimeUpdate = (elapsed: number) => { timeElapsed = elapsed; };

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
          const x = WT + Math.random() * (GW - WT * 2);
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

  // Touch handling — tap to destroy, drag to move
  let touchStartPos: { x: number; y: number } | null = null;
  let touchStartTime = 0;

  function handleTouchStart(event: TouchEvent) {
    if (showTutorial) dismissTutorial();
    if (currentGameState !== 'playing') return;
    const touch = event.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    touchStartTime = Date.now();
  }

  function handleTouchEnd(event: TouchEvent) {
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

  // @ts-ignore
  function handleCanvasClick(event: MouseEvent) {
    if (showTutorial) dismissTutorial();
    if (currentGameState !== 'playing') return;
    const rect = container.getBoundingClientRect();
    gameLoop.tryDetonate(event.clientX - rect.left, event.clientY - rect.top);
  }

  function dismissTutorial() {
    showTutorial = false;
    try { localStorage.setItem('stacks_tutorial_seen', 'true'); } catch(e) {}
  }

  $: fillLevelPercent = fillLevel * 100;
  $: isGameOver = currentGameState === 'gameOver';
  $: isPaused = currentGameState === 'paused';
</script>

<!-- Mobile layout — full screen, no margins -->
<div class="fixed inset-0 bg-neutral-900 overflow-hidden">
  <!-- Fill level bar — thin strip at very top -->
  <div class="absolute top-0 left-0 right-0 h-[3px] bg-neutral-800" style="z-index: 20;">
    <div
      class="h-full transition-all duration-300"
      class:bg-lime-500={fillLevelPercent <= 40}
      class:bg-amber-400={fillLevelPercent > 40 && fillLevelPercent <= 60}
      class:bg-red-500={fillLevelPercent > 60}
      style="width: {Math.min(fillLevelPercent, 100)}%"
    ></div>
  </div>

  <!-- Canvas container -->
  <div
    bind:this={container}
    class="w-full h-full"
    on:click={handleCanvasClick}
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
  >
  </div>

  <!-- Compact HUD — top strip -->
  <div class="absolute top-[3px] left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-black/40 font-mono text-xs text-amber-100" style="z-index: 25;">
    <div class="flex items-center gap-3">
      <span>{score} <span class="text-amber-500/50 text-[10px]">Best {highScore}</span></span>
    </div>
    <div class="flex items-center gap-3 text-amber-400/70">
      <span>W{currentWave}</span>
      <span>{Math.floor(timeElapsed)}s</span>
    </div>
  </div>

  <!-- Icon buttons — top right, below HUD strip -->
  <div class="absolute top-10 right-2 flex flex-col gap-2" style="z-index: 25;">
    <button
      on:click={pauseGame}
      class="w-9 h-9 rounded-full bg-black/50 border border-amber-900/30 flex items-center justify-center text-amber-200 text-sm active:bg-amber-900/30 transition-colors"
    >⏸</button>
    <button
      on:click={resetGame}
      class="w-9 h-9 rounded-full bg-black/50 border border-amber-900/30 flex items-center justify-center text-amber-200 text-sm active:bg-amber-900/30 transition-colors"
    >↺</button>
  </div>

  <!-- Combo Popup -->
  {#if comboVisible}
    <div
      class="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none font-mono text-center"
      style="z-index: 40;"
      in:fly={{ y: 30, duration: 250 }}
      out:fly={{ y: -40, duration: 500 }}
    >
      <span class="text-3xl font-black text-orange-400 drop-shadow-[0_0_20px_rgba(255,100,0,0.6)]">
        {comboText}
      </span>
    </div>
  {/if}

  <!-- Wave Milestone -->
  {#if waveMilestoneVisible}
    <div
      class="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none font-mono text-center"
      style="z-index: 40;"
      in:fly={{ y: -30, duration: 350 }}
      out:fade={{ duration: 600 }}
    >
      <div class="bg-amber-900/80 border border-amber-600 px-4 py-2 rounded">
        <p class="text-sm font-bold text-amber-200">Wave {waveMilestone} Cleared!</p>
        <p class="text-[10px] text-amber-400/80 mt-0.5">Blocks falling faster...</p>
      </div>
    </div>
  {/if}

  <!-- Tutorial -->
  {#if showTutorial && currentGameState === 'playing'}
    <div
      class="absolute inset-0 pointer-events-none flex items-center justify-center font-mono"
      style="z-index: 35;"
      transition:fade={{ duration: 300 }}
    >
      <div class="text-center mt-10">
        <div class="text-4xl mb-2 animate-bounce">👇</div>
        <div class="bg-black/70 px-5 py-2.5 rounded-lg">
          <p class="text-amber-200 text-base font-bold">TAP a dirt block!</p>
          <p class="text-amber-400/70 text-[11px] mt-1">Tap to destroy blocks</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Game Over Modal -->
  {#if isGameOver}
    <div class="absolute inset-0 bg-black/90 flex items-center justify-center font-mono px-4" style="z-index: 50;">
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

      <div class="bg-neutral-950 p-6 border border-neutral-700 w-full max-w-sm shadow-2xl relative" in:fly={{ y: 30, duration: 350 }}>
        {#if isNewHighScore}
          <div class="text-center mb-3">
            <span class="text-yellow-400 text-xs font-bold tracking-widest uppercase animate-pulse">New Personal Best!</span>
          </div>
        {/if}

        <h2 class="text-xl font-bold mb-2" class:text-red-500={gameOverReason === 'protected'} class:text-orange-400={gameOverReason !== 'protected'}>
          {gameOverReason === 'protected' ? 'Protected Block Destroyed!' : 'The Box is Full!'}
        </h2>
        <p class="text-neutral-300 mb-4 text-xs leading-relaxed">
          {#if gameOverReason === 'protected'}
            You caught a <span class="text-red-400 font-semibold">protected block</span> in an explosion.
          {:else}
            You survived <span class="text-white font-semibold">{timeElapsed.toFixed(1)}s</span> before the blocks overwhelmed you.
          {/if}
        </p>

        <div class="bg-neutral-800/80 border border-neutral-700 p-3 rounded mb-4">
          <p class="text-base text-white mb-1">
            Score: <span class="text-cyan-400 font-bold text-lg">{score}</span>
            {#if highScore > 0}
              <span class="text-neutral-500 text-xs ml-2">Best: {highScore}</span>
            {/if}
          </p>
          <div class="flex gap-4 text-neutral-400 text-xs">
            <p>Wave <span class="text-neutral-200">{currentWave}</span></p>
            <p>Survived <span class="text-neutral-200">{timeElapsed.toFixed(1)}s</span></p>
            <p>Cleared <span class="text-neutral-200">{blocksCleared}</span></p>
          </div>
        </div>

        <button
          on:click={resetGame}
          class="w-full px-4 py-4 bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 active:bg-neutral-600 text-white text-sm font-medium transition-colors rounded"
        >
          Play Again
        </button>
      </div>
    </div>
  {/if}

  <!-- Pause Overlay -->
  {#if isPaused}
    <div class="absolute inset-0 bg-black/90 flex items-center justify-center font-mono px-4" style="z-index: 50;" transition:fade={{ duration: 200 }}>
      <div class="bg-neutral-900 text-amber-100 p-6 border border-amber-900/30 w-full max-w-xs">
        <h2 class="text-lg mb-4 text-center">Paused</h2>
        <button
          on:click={pauseGame}
          class="w-full px-4 py-4 border border-amber-900/30 hover:bg-amber-900/20 active:bg-amber-900/30 text-sm transition-colors"
        >
          Resume
        </button>
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
    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
</style>
