export class GameLoop {
  // @ts-ignore
  constructor(physics, gameConfig) {
    this.physics = physics;
    this.config = gameConfig;
    this.gameState = 'playing'; // 'playing', 'paused', 'gameOver', 'won'
    this.currentWave = 1;
    this.blocksDropped = 0;
    this.score = 0;
    this.timeElapsed = 0;
    this.finalScore = 0; // Store final score separately
    this.gameTimeLimit = 60; // 60 seconds total game time
    this.timeRemaining = 60;
    this.nextDropTime = 0;
    this.detonationCooldown = 0;
    this.chainMultiplier = 1;
    this.lastUpdateTime = Date.now();
    
    // Game mechanics
    this.dropInterval = 5000; // Start with 5 seconds between drops
    this.blocksPerWave = 2; // Drop 2 blocks at a time
    this.maxFloorCoverage = 1.0; // 100% settled floor coverage triggers game over
    this.baseDropSpeed = 5000; // 5 seconds between drops initially
    this.minDropInterval = 2000; // Minimum 2 seconds between drops (faster than before)
    this.maxBlocksPerWave = 8; // Increased from 5 to 8 maximum blocks
    
    // Detonation mechanics
    this.lastDetonationTime = 0;
    this.canDetonate = true;
    
    // Block dropping pattern
    this.explosiveBlockInterval = 6; // Drop explosive block every 6th block
    
    // Scoring system
    this.baseDestroyScore = 10; // Base points for destroying a block
    this.maxChainMultiplier = 5; // Cap the chain multiplier
    
    // Timers
    this.gameStartTime = Date.now();
    
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
    
    this.boundUpdate = this.update.bind(this);

    // Set up block destruction callback
    this.physics.setBlockDestroyedCallback(() => {
      // Time bonus removed
    });
  }

  start() {
    if (this.gameState !== 'playing') return;
    
    const now = Date.now();
    this.gameStartTime = now;
    this.nextDropTime = now;
    this.score = 0;
    this.finalScore = 0;
    this.timeRemaining = this.gameTimeLimit;
    
    // Ensure we're in playing state
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
    // Stop any ongoing game logic
    this.gameState = 'playing';
    this.currentWave = 1;
    this.blocksDropped = 0;
    this.score = 0;
    this.finalScore = 0;
    this.timeElapsed = 0;
    this.timeRemaining = this.gameTimeLimit;
    
    // Reset timers
    const now = Date.now();
    this.gameStartTime = now;
    this.nextDropTime = now;
    this.dropInterval = this.baseDropSpeed;
    
    // Reset detonation state
    this.canDetonate = true;
    this.lastDetonationTime = 0;
    this.detonationCooldown = 0;
    
    // Reset all notifications
    this.notifyGameStateChange();
    this.notifyWaveChange();
    this.notifyScoreChange();
    if (this.onCooldownChange) {
      this.onCooldownChange(0);
    }
  }

  endGame() {
    if (this.gameState === 'playing') {
      this.finalScore = this.score; // Store the final score
      this.gameState = 'gameOver';
      this.notifyGameStateChange();
      // Freeze the physics state
      this.physics.clearAllBodies();
    }
  }

  // @ts-ignore
  update(deltaTime) {
    if (this.gameState !== 'playing') return;

    const currentTime = Date.now();
    this.timeElapsed = (currentTime - this.gameStartTime) / 1000;
    this.timeRemaining = Math.max(0, this.gameTimeLimit - this.timeElapsed);

    // Check if time's up
    if (this.timeRemaining <= 0) {
      this.endGame();
      return;
    }

    // Update detonation cooldown
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

    // Check game over condition - floor coverage
    const floorCoverage = this.physics.getFloorCoverage();
    if (floorCoverage >= this.maxFloorCoverage) {
      this.endGame();
      return;
    }

    // Handle block dropping only if game is still active
    if (currentTime - this.nextDropTime >= this.dropInterval) {
      for (let i = 0; i < this.blocksPerWave; i++) {
        this.dropBlock();
      }
      this.nextDropTime = currentTime;
    }

    // Update difficulty over time
    this.updateDifficulty();

    // Notify time update
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.timeRemaining);
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
    
    // Determine block type based on count and pattern
    let blockType;
    if ((this.blocksDropped + 1) % this.explosiveBlockInterval === 0) {
      blockType = 'explosive';
    } else {
      // Random selection between available non-explosive blocks
      const normalBlocks = ['dirt', 'stone', 'dirt_top'];
      blockType = normalBlocks[Math.floor(Math.random() * normalBlocks.length)];
    }
    
    this.physics.createCrate(x, y, blockType);
    this.blocksDropped++;

    // Check for wave progression only if game is still active
    if (this.gameState === 'playing' && this.blocksDropped % this.blocksPerWave === 0) {
      this.currentWave++;
      this.notifyWaveChange();
    }
  }

  updateDifficulty() {
    // More aggressive difficulty scaling
    const difficultyMultiplier = 1 + (this.currentWave - 1) * 0.2; // Increased from 0.15 to 0.2
    
    // Drop interval decreases more quickly but has a lower minimum
    this.dropInterval = Math.max(
      this.minDropInterval,
      this.baseDropSpeed / difficultyMultiplier
    );
    
    // More aggressive block increase
    // Start with 2 blocks, add 1 block every 2 waves
    const baseBlocks = 2;
    const additionalBlocks = Math.floor((this.currentWave - 1) / 2);
    this.blocksPerWave = Math.min(this.maxBlocksPerWave, baseBlocks + additionalBlocks);
    
    // Adjust explosive block frequency based on wave
    // More frequent explosive blocks in later waves
    this.explosiveBlockInterval = Math.max(4, 8 - Math.floor(this.currentWave / 5));
    
    // Keep floor coverage tolerance at 100%
    this.maxFloorCoverage = 1.0;
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
        // Only update score if game is still active
        const chainSize = this.physics.getLastChainReactionSize() || 1;
        const multiplier = Math.min(chainSize * this.chainMultiplier, this.maxChainMultiplier);
        const destroyScore = Math.floor(this.baseDestroyScore * multiplier * this.currentWave);
        
        this.score += destroyScore;
        this.notifyScoreChange();
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
      timeElapsed: this.timeElapsed,
      blocksDropped: this.blocksDropped,
      floorCoverage: this.physics.getFloorCoverage(),
      nextDropIn: this.gameState === 'playing' ? 
        Math.max(0, this.dropInterval - (Date.now() - this.nextDropTime)) : 0,
      canDetonate: this.canDetonate && this.gameState === 'playing',
      detonationCooldown: this.gameState === 'playing' ? 
        (this.canDetonate ? 0 : Math.max(0, this.detonationCooldown - (Date.now() - this.lastDetonationTime)) / 1000) : 0
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