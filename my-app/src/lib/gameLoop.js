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
    
    // Game mechanics
    this.dropInterval = 3000; // milliseconds between drops
    this.blocksPerWave = 5;
    this.maxFloorCoverage = 0.8; // 80% floor coverage triggers game over
    this.baseDropSpeed = 1500; // gets faster over time
    
    // Detonation mechanics
    this.detonationCooldown = 5000; // 5 seconds cooldown
    this.lastDetonationTime = 0;
    this.canDetonate = true;
    
    // Block dropping pattern
    this.explosiveBlockInterval = 6; // Drop explosive block every 6th block
    
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
    this.gameState = 'playing';
    this.gameStartTime = Date.now();
    this.lastDropTime = this.gameStartTime;
    this.notifyGameStateChange();
  }

  pause() {
    this.gameState = 'paused';
    this.notifyGameStateChange();
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
    this.timeElapsed = 0;
    this.gameStartTime = Date.now();
    this.lastDropTime = this.gameStartTime;
    this.dropInterval = this.baseDropSpeed;
    
    // Clear all physics bodies
    this.physics.clearAllBodies();
    
    this.notifyGameStateChange();
    this.notifyWaveChange();
    this.notifyScoreChange();
  }

  // @ts-ignore
  // @ts-ignore
  update(deltaTime) {
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
      this.gameState = 'won';
      this.notifyGameStateChange();
      return;
    }

    // Check game over condition - floor coverage
    const floorCoverage = this.physics.getFloorCoverage();
    if (floorCoverage >= this.maxFloorCoverage) {
      this.gameState = 'gameOver';
      this.notifyGameStateChange();
      return;
    }

    // Handle block dropping
    if (currentTime - this.lastDropTime >= this.dropInterval) {
      this.dropBlock();
      this.lastDropTime = currentTime;
    }

    // Update difficulty over time
    this.updateDifficulty();
  }

  dropBlock() {
    // Random X position within walls
    const minX = this.config.wallThickness + 40;
    const maxX = this.config.gameWidth - this.config.wallThickness - 40;
    const x = Math.random() * (maxX - minX) + minX;
    const y = -80; // spawn above canvas
    
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
    
    // Award points for surviving drops
    this.score += 5;
    this.notifyScoreChange();

    // Check for wave progression
    if (this.blocksDropped % this.blocksPerWave === 0) {
      this.currentWave++;
      // Bonus points for completing a wave
      this.score += this.currentWave * 25;
      this.notifyWaveChange();
    }
  }

  updateDifficulty() {
    // Increase drop frequency over time
    const difficultyMultiplier = 1 + (this.currentWave - 1) * 0.15;
    this.dropInterval = Math.max(800, this.baseDropSpeed / difficultyMultiplier);
    
    // Slightly increase floor coverage tolerance early on
    if (this.currentWave <= 3) {
      this.maxFloorCoverage = 0.8 + (this.currentWave - 1) * 0.05;
    }
  }

  // Detonation control
  // @ts-ignore
  tryDetonate(x, y) {
    if (!this.canDetonate) return false;
    
    if (this.physics.selectExplosiveBlock(x, y)) {
      this.canDetonate = false;
      this.lastDetonationTime = Date.now();
      
      const success = this.physics.detonateSelectedBlock();
      if (success) {
        this.score += 50;
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
      score: this.score,
      timeElapsed: this.timeElapsed,
      blocksDropped: this.blocksDropped,
      floorCoverage: this.physics.getFloorCoverage(),
      nextDropIn: Math.max(0, this.dropInterval - (Date.now() - this.lastDropTime)),
      canDetonate: this.canDetonate,
      detonationCooldown: this.canDetonate ? 0 : 
        Math.max(0, this.detonationCooldown - (Date.now() - this.lastDetonationTime)) / 1000
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
      this.onScoreChange(this.score);
    }
  }

  // Cleanup
  destroy() {
    // Clean up any timers or intervals if needed
  }
}