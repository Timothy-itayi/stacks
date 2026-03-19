export class GameLoop {
  // @ts-ignore
  constructor(physics, gameConfig) {
    this.physics = physics;
    this.config = gameConfig;
    this.gameState = 'playing';
    this.currentWave = 1;
    this.blocksDropped = 0;
    this.score = 0;
    this.timeElapsed = 0;
    this.finalScore = 0;
    this.nextDropTime = 0;
    this.detonationCooldown = 0;
    this.chainMultiplier = 1;
    this.lastUpdateTime = Date.now();
    this.gameOverReason = '';
    this.blocksCleared = 0;
    this.highScore = 0;
    this.isNewHighScore = false;
    try { this.highScore = parseInt(localStorage.getItem('stacks_high_score') || '0', 10); } catch(e) {}

    // Game mechanics
    this.dropInterval = 3500;
    this.baseDropSpeed = 3500;

    // Detonation mechanics
    this.lastDetonationTime = 0;
    this.canDetonate = true;

    // Block dropping pattern
    this.explosiveBlockInterval = 6;

    // Scoring system
    this.baseDestroyScore = 10;
    this.maxChainMultiplier = 5;

    // Timers
    this.gameStartTime = Date.now();
    this.lastWaveTime = Date.now();

    // Events
    // @ts-ignore
    this.onGameStateChange = null;
    // @ts-ignore
    this.onWaveChange = null;
    // @ts-ignore
    this.onScoreChange = null;
    // @ts-ignore
    this.onCooldownChange = null;
    // @ts-ignore
    this.onTimeUpdate = null;
    // @ts-ignore
    this.onCombo = null;
    // @ts-ignore
    this.onWaveMilestone = null;

    this.boundUpdate = this.update.bind(this);

    this.physics.setBlockDestroyedCallback(() => {});
  }

  start() {
    if (this.gameState !== 'playing') return;

    const now = Date.now();
    this.gameStartTime = now;
    this.lastWaveTime = now;
    this.nextDropTime = now;
    this.score = 0;
    this.finalScore = 0;

    this.gameState = 'playing';
    this.notifyGameStateChange();
    this.notifyScoreChange();
  }

  pause() {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
      this.notifyGameStateChange();
    }
  }

  resume() {
    if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this.notifyGameStateChange();
    }
  }

  reset() {
    this.gameState = 'playing';
    this.currentWave = 1;
    this.blocksDropped = 0;
    this.score = 0;
    this.finalScore = 0;
    this.timeElapsed = 0;

    const now = Date.now();
    this.gameStartTime = now;
    this.lastWaveTime = now;
    this.nextDropTime = now;
    this.dropInterval = this.baseDropSpeed;

    this.canDetonate = true;
    this.lastDetonationTime = 0;
    this.detonationCooldown = 0;
    this.gameOverReason = '';
    this.blocksCleared = 0;
    this.isNewHighScore = false;
    this.physics.resetProtectedBlockFlag();

    this.notifyGameStateChange();
    this.notifyWaveChange();
    this.notifyScoreChange();
    if (this.onCooldownChange) {
      this.onCooldownChange(0);
    }
  }

  endGame() {
    if (this.gameState === 'playing') {
      this.finalScore = this.score;

      if (this.finalScore > this.highScore) {
        this.highScore = this.finalScore;
        this.isNewHighScore = true;
        try { localStorage.setItem('stacks_high_score', String(this.highScore)); } catch(e) {}
      }

      this.gameState = 'gameOver';
      this.notifyGameStateChange();
      this.physics.clearAllBodies();
    }
  }

  // @ts-ignore
  update(deltaTime) {
    if (this.gameState !== 'playing') return;

    const currentTime = Date.now();
    this.timeElapsed = (currentTime - this.gameStartTime) / 1000;

    // Detonation cooldown
    if (!this.canDetonate) {
      const cooldownRemaining = this.detonationCooldown - (currentTime - this.lastDetonationTime);
      if (cooldownRemaining <= 0) {
        this.canDetonate = true;
        if (this.onCooldownChange) {
          this.onCooldownChange(0);
        }
      } else if (this.onCooldownChange) {
        this.onCooldownChange(cooldownRemaining / 1000);
      }
    }

    // Game over when the box fills up
    if (this.physics.isGameOverCondition()) {
      this.gameOverReason = 'fill';
      this.endGame();
      return;
    }

    // Game over if a protected block was caught in an explosion
    if (this.physics.wasProtectedBlockDestroyed()) {
      this.gameOverReason = 'protected';
      this.endGame();
      return;
    }

    // Wave progression: every 15 seconds
    if ((currentTime - this.lastWaveTime) / 1000 >= 15) {
      this.currentWave++;
      this.lastWaveTime = currentTime;
      this.notifyWaveChange();

      if (this.currentWave % 5 === 0 && this.onWaveMilestone) {
        this.onWaveMilestone(this.currentWave);
      }
    }

    // Update difficulty based on elapsed time
    this.updateDifficulty();

    // Drop blocks
    if (currentTime - this.nextDropTime >= this.dropInterval) {
      const minBlocks = Math.min(5, 1 + Math.floor(this.timeElapsed / 30));
      const dropCount = minBlocks + Math.floor(Math.random() * (10 - minBlocks + 1));
      for (let i = 0; i < dropCount; i++) {
        this.dropBlock();
      }
      this.nextDropTime = currentTime;
    }

    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.timeElapsed);
    }
  }

  dropBlock() {
    // Don't drop blocks if game is not in playing state
    if (this.gameState !== 'playing') return;
    
    // Random X position within walls, with wider range
    const minX = this.config.wallThickness;
    const maxX = this.config.gameWidth - this.config.wallThickness;
    const x = Math.random() * (maxX - minX) + minX;
    
    // Random Y position well above the canvas
    const minY = -200;
    const maxY = -400;
    const y = Math.random() * (maxY - minY) + minY;
    
    let blockType;
    if ((this.blocksDropped + 1) % this.explosiveBlockInterval === 0) {
      blockType = 'explosive';
    } else if ((this.blocksDropped + 1) % 18 === 0) {
      blockType = 'protected';
    } else {
      const normalBlocks = ['dirt', 'stone', 'dirt_top'];
      blockType = normalBlocks[Math.floor(Math.random() * normalBlocks.length)];
    }
    
    this.physics.createCrate(x, y, blockType);
    this.blocksDropped++;
  }

  updateDifficulty() {
    this.dropInterval = Math.max(800, this.baseDropSpeed - this.timeElapsed * 30);
    this.explosiveBlockInterval = Math.max(3, 6 - Math.floor(this.timeElapsed / 20));
  }

  // Detonation control
  // @ts-ignore
  tryDetonate(x, y) {
    // Don't allow detonation if game is not in playing state
    if (this.gameState !== 'playing' || !this.canDetonate) return false;
    
    if (this.physics.selectExplosiveBlock(x, y)) {
      this.canDetonate = false;
      this.lastDetonationTime = Date.now();
      
      const success = this.physics.detonateSelectedBlock();
      if (success && this.gameState === 'playing') {
        const chainSize = this.physics.getLastChainReactionSize() || 1;
        const multiplier = Math.min(chainSize * this.chainMultiplier, this.maxChainMultiplier);
        const destroyScore = Math.floor(this.baseDestroyScore * multiplier * this.currentWave);
        
        this.score += destroyScore;
        this.notifyScoreChange();

        if (success === 'destroy') {
          this.blocksCleared++;
        } else if (success === 'explosion') {
          const blastCount = this.physics.getLastExplosionBlockCount() || 0;
          this.blocksCleared += 1 + blastCount;
          if (blastCount > 1 && this.onCombo) {
            this.onCombo(blastCount);
          }
        }
      }
      
      if (this.onCooldownChange) {
        this.onCooldownChange(1.5); // Update to show 1.5 second cooldown
      }
      
      return success;
    }
    return false;
  }

  // Remove power-ups as they're no longer needed
  clearBottomRow() {
    return false;
  }

  slowTime() {
    return false;
  }

  // Getters
  getGameState() {
    return {
      state: this.gameState,
      wave: this.currentWave,
      score: this.gameState === 'gameOver' ? this.finalScore : this.score,
      gameOverReason: this.gameOverReason,
      timeElapsed: this.timeElapsed,
      blocksDropped: this.blocksDropped,
      fillLevel: this.physics.getFillLevel(),
      canDetonate: this.canDetonate && this.gameState === 'playing',
      detonationCooldown: this.gameState === 'playing' ?
        (this.canDetonate ? 0 : Math.max(0, this.detonationCooldown - (Date.now() - this.lastDetonationTime)) / 1000) : 0,
      blocksCleared: this.blocksCleared,
      highScore: this.highScore,
      isNewHighScore: this.isNewHighScore
    };
  }

  // Event handlers
  notifyGameStateChange() {
    if (this.onGameStateChange) {
      this.onGameStateChange(this.gameState);
    }
  }

  notifyWaveChange() {
    if (this.onWaveChange) {
      this.onWaveChange(this.currentWave);
    }
  }

  notifyScoreChange() {
    if (this.onScoreChange) {
      this.onScoreChange(this.gameState === 'gameOver' ? this.finalScore : this.score);
    }
  }

  // Cleanup
  destroy() {
    // Clean up any timers or intervals if needed
  }
}