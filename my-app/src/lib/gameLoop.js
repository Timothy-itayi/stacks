// @ts-nocheck
import * as physics from './physics.js';
import { gameState } from './gameState.js';

let ticker = null;

export function startLoop(app, onWin = () => {}, onLose = () => {}) {
  if (gameState.isPlaying) return;

  gameState.isPlaying = true;
  gameState.isGameOver = false;

  ticker = () => {
    // ⬅️ this line must be included
    physics.update();

    applyWind();

    const stackHeight = physics.getHighestCrateY();
    const screenHeight = app.renderer.height;

    if (screenHeight - stackHeight >= gameState.targetHeight) {
      gameState.isGameOver = true;
      stopLoop(app);
      onWin();
    }

    if (physics.hasFallenCrates(screenHeight)) {
      gameState.isGameOver = true;
      stopLoop(app);
      onLose();
    }
  };

  app.ticker.add(ticker);
}

export function stopLoop(app) {
  if (!ticker) return;
  app.ticker.remove(ticker);
  ticker = null;
  gameState.isPlaying = false;
}

function applyWind() {
  physics.applyForceToAll({
    x: (Math.random() - 0.5) * gameState.villainForce,
    y: 0
  });
}
