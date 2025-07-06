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
  update(deltaTime) {
    if (this.gameState !== 'playing') return;

    const currentTime = Date.now();
    this.timeElapsed = (currentTime - this.gameStartTime) / 1000;

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
    const blockAliases = ['block', 'block00', 'block01', 'block02', 'block03', 'block04'];
    const alias = blockAliases[Math.floor(Math.random() * blockAliases.length)];
    
    // Random X position within walls
    const minX = this.config.wallThickness + 40;
    const maxX = this.config.gameWidth - this.config.wallThickness - 40;
    const x = Math.random() * (maxX - minX) + minX;
    const y = -80; // spawn above canvas
    
    this.physics.createCrate(x, y, alias);
    this.blocksDropped++;
    
    // Award points for surviving drops
    this.score += 10;
    this.notifyScoreChange();

    // Check for wave progression
    if (this.blocksDropped % this.blocksPerWave === 0) {
      this.currentWave++;
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

  // Bonus actions
  clearBottomRow() {
    if (this.score >= 50) {
      this.physics.clearBottomRow();
      this.score -= 50;
      this.notifyScoreChange();
      return true;
    }
    return false;
  }

  slowTime() {
    if (this.score >= 30) {
      this.dropInterval *= 2;
      this.score -= 30;
      this.notifyScoreChange();
      
      // Reset after 5 seconds
      setTimeout(() => {
        this.updateDifficulty();
      }, 5000);
      return true;
    }
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
      nextDropIn: Math.max(0, this.dropInterval - (Date.now() - this.lastDropTime))
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