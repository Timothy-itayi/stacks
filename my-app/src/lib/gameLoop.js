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
    
    // Game mechanics
    this.dropInterval = 3000; // milliseconds between drops
    this.blocksPerWave = 5;
    this.maxFloorCoverage = 0.85; // 85% settled floor coverage triggers game over
    this.baseDropSpeed = 1500; // gets faster over time
    
    // Detonation mechanics
    this.detonationCooldown = 5000; // 5 seconds cooldown
    this.lastDetonationTime = 0;
    this.canDetonate = true;
    
    // Block dropping pattern
    this.explosiveBlockInterval = 6; // Drop explosive block every 6th block
    
    // Scoring system
    this.baseDestroyScore = 10; // Base points for destroying a block
    this.chainMultiplier = 1.5; // Multiplier for chain reactions
    this.maxChainMultiplier = 5; // Cap the chain multiplier
    this.waveBonus = 25; // Points for completing a wave
    
    // Timers
    this.lastDropTime = 0;
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
    
    this.boundUpdate = this.update.bind(this);
  }

  start() {
    if (this.gameState !== 'playing') return;
    
    const now = Date.now();
    this.gameStartTime = now;
    this.lastDropTime = now;
    this.score = 0;
    this.finalScore = 0;
    
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
    
    // Reset timers
    const now = Date.now();
    this.gameStartTime = now;
    this.lastDropTime = now;
    this.dropInterval = this.baseDropSpeed;
    
    // Reset detonation state
    this.canDetonate = true;
    this.lastDetonationTime = 0;
    
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
    // Don't update anything if game is not in playing state
    if (this.gameState !== 'playing') return;

    const currentTime = Date.now();
    this.timeElapsed = (currentTime - this.gameStartTime) / 1000;

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

    // Check win condition
    if (this.physics.getCurrentStackHeight() >= this.config.targetHeight) {
      this.endGame();
      return;
    }

    // Check game over condition - floor coverage
    const floorCoverage = this.physics.getFloorCoverage();
    if (floorCoverage >= this.maxFloorCoverage) {
      this.endGame();
      return;
    }

    // Handle block dropping only if game is still active
    if (currentTime - this.lastDropTime >= this.dropInterval) {
      this.dropBlock();
      this.lastDropTime = currentTime;
    }

    // Update difficulty over time
    this.updateDifficulty();
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
      // Wave completion bonus
      this.score += this.waveBonus * this.currentWave;
      this.notifyScoreChange();
      this.notifyWaveChange();
    }
  }

  updateDifficulty() {
    // Increase drop frequency over time
    const difficultyMultiplier = 1 + (this.currentWave - 1) * 0.15;
    this.dropInterval = Math.max(800, this.baseDropSpeed / difficultyMultiplier);
    
    // Slightly increase floor coverage tolerance in early waves
    if (this.currentWave <= 3) {
      this.maxFloorCoverage = 0.85 + (3 - this.currentWave) * 0.05; // More forgiving in early waves
    } else {
      this.maxFloorCoverage = 0.85; // Standard tolerance after wave 3
    }
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
        this.onCooldownChange(5);
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
        Math.max(0, this.dropInterval - (Date.now() - this.lastDropTime)) : 0,
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