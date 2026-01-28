// Entry point

import { Game } from './Game.js';

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    canvas.width = 1024;
    canvas.height = 600;
    
    const game = new Game(canvas);
    game.loop();
});
