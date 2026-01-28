// CPU AI for enemy worms

import { distance } from './utils.js';

export class AI {
    constructor(difficulty) {
        this.difficulty = difficulty;
        this.thinkTime = 0;
        this.decided = false;
        this.action = null;
        
        // Difficulty settings
        this.settings = {
            easy: {
                aimError: 0.3,      // Radians of aim error
                powerError: 0.25,   // Percentage of power error
                thinkDelay: 90,     // Frames before acting
                moveChance: 0.25,   // Chance to move instead of shoot
                checksBlocked: false, // Whether AI checks for obstacles
            },
            medium: {
                aimError: 0.15,
                powerError: 0.1,
                thinkDelay: 60,
                moveChance: 0.1,
                checksBlocked: true,
            },
            hard: {
                aimError: 0.03,
                powerError: 0.03,
                thinkDelay: 30,
                moveChance: 0.02,
                checksBlocked: true,
            }
        };
    }

    reset() {
        this.thinkTime = 0;
        this.decided = false;
        this.action = null;
    }

    update(currentWorm, playerWorms, terrain, wind) {
        const config = this.settings[this.difficulty];
        
        this.thinkTime++;
        
        if (this.thinkTime < config.thinkDelay) {
            return null;
        }

        if (!this.decided) {
            this.decide(currentWorm, playerWorms, terrain, wind, config);
            this.decided = true;
        }

        return this.action;
    }

    decide(worm, targets, terrain, wind, config) {
        // Find alive targets
        const aliveTargets = targets.filter(t => t.alive);
        if (aliveTargets.length === 0) {
            this.action = { type: 'wait' };
            return;
        }

        // Find best target (closest and lowest health)
        let bestTarget = aliveTargets[0];
        let bestScore = -Infinity;
        
        for (const target of aliveTargets) {
            const dist = distance(worm.x, worm.y, target.x, target.y);
            // Prefer closer targets and lower health targets
            const score = (1000 - dist) + (100 - target.health) * 3;
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }

        const dx = bestTarget.x - worm.x;
        const dy = bestTarget.y - worm.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if terrain is blocking direct line of sight
        const isBlocked = config.checksBlocked && this.isPathBlocked(worm, bestTarget, terrain);
        
        // If blocked and close, move to get a better angle
        if (isBlocked && dist < 200) {
            // Move away from obstacle
            const moveDir = worm.x < terrain.width / 2 ? -1 : 1;
            this.action = {
                type: 'move',
                direction: moveDir
            };
            return;
        }

        // Random chance to move or jump
        const randomAction = Math.random();
        if (randomAction < config.moveChance) {
            // Move towards target if far, random if close
            const moveDir = dist > 300 ? Math.sign(dx) : (Math.random() > 0.5 ? 1 : -1);
            this.action = {
                type: 'move',
                direction: moveDir
            };
            return;
        } else if (randomAction < config.moveChance * 1.5) {
            this.action = {
                type: 'jump',
                direction: Math.sign(dx) || 1
            };
            return;
        }

        // Calculate shot - use proper ballistic calculation
        const shot = this.calculateShot(worm, bestTarget, wind);
        
        // Add error based on difficulty
        const aimError = (Math.random() - 0.5) * 2 * config.aimError;
        const powerError = 1 + (Math.random() - 0.5) * 2 * config.powerError;
        
        let finalAngle = shot.angle + aimError;
        let finalPower = Math.min(1, Math.max(0.3, shot.power * powerError));
        
        // Clamp angle to valid shooting range (upward angles only)
        finalAngle = Math.max(-Math.PI, Math.min(0, finalAngle));
        
        this.action = {
            type: 'shoot',
            angle: finalAngle,
            power: finalPower
        };
    }

    isPathBlocked(worm, target, terrain) {
        // Check if there's terrain between worm and target
        const steps = 10;
        const dx = (target.x - worm.x) / steps;
        const dy = (target.y - worm.y) / steps;
        
        for (let i = 1; i < steps; i++) {
            const checkX = worm.x + dx * i;
            const checkY = worm.y - 10 + dy * i; // Start from worm's "head"
            if (terrain.isSolid(checkX, checkY)) {
                return true;
            }
        }
        return false;
    }

    calculateShot(worm, target, wind) {
        const dx = target.x - worm.x;
        const dy = target.y - worm.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate required power based on distance
        // More distance = more power needed
        let power = Math.min(1, Math.max(0.4, dist / 350));
        
        let bestAngle = -Math.PI / 4; // Default 45 degrees up
        let bestError = Infinity;
        
        // Try different angles to find one that hits close to target
        for (let testAngle = -0.1; testAngle >= -Math.PI + 0.1; testAngle -= 0.1) {
            const result = this.simulateShot(worm.x, worm.y - 12, testAngle, power, wind, 180);
            
            const errorX = Math.abs(result.x - target.x);
            const errorY = Math.abs(result.y - target.y);
            const error = errorX + errorY * 0.5; // Weight horizontal accuracy more
            
            if (error < bestError) {
                bestError = error;
                bestAngle = testAngle;
            }
        }
        
        // If error is still high, try adjusting power too
        if (bestError > 100) {
            for (let testPower = 0.3; testPower <= 1; testPower += 0.1) {
                for (let testAngle = -0.2; testAngle >= -Math.PI + 0.2; testAngle -= 0.15) {
                    const result = this.simulateShot(worm.x, worm.y - 12, testAngle, testPower, wind, 180);
                    
                    const errorX = Math.abs(result.x - target.x);
                    const errorY = Math.abs(result.y - target.y);
                    const error = errorX + errorY * 0.5;
                    
                    if (error < bestError) {
                        bestError = error;
                        bestAngle = testAngle;
                        power = testPower;
                    }
                }
            }
        }
        
        return { angle: bestAngle, power };
    }

    simulateShot(startX, startY, angle, power, wind, maxFrames) {
        // Simulate projectile trajectory (no terrain collision)
        const speed = power * 15;
        let x = startX + Math.cos(angle) * 20;
        let y = startY + Math.sin(angle) * 20;
        let vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;
        const gravity = 0.3;
        
        for (let i = 0; i < maxFrames; i++) {
            vx += wind * 0.01;
            vy += gravity;
            x += vx;
            y += vy;
            
            // Stop if projectile is falling and below start height
            if (vy > 0 && y > startY + 50) {
                break;
            }
        }
        
        return { x, y };
    }
}
