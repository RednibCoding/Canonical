// Worm entity

import { clamp } from './utils.js';

export class Worm {
    constructor(x, y, team, name) {
        this.x = x;
        this.y = y;
        this.team = team; // 'player' or 'enemy'
        this.name = name;
        this.health = 100;
        this.alive = true;
        this.width = 20;
        this.height = 20; // Visual height of worm
        this.velocityX = 0;
        this.velocityY = 0;
        this.grounded = false;
        this.aimAngle = team === 'player' ? -Math.PI / 4 : -3 * Math.PI / 4;
        this.facingRight = team === 'player';
        this.gravity = 0.5;
        this.moveSpeed = 2;
        this.fallDamageThreshold = 50; // Higher threshold = less fall damage
        this.fallStartY = null;
        this.isJumping = false; // Track if this is a voluntary jump
        
        // Auto-movement state
        this.autoMoveDirection = 0;
        this.autoMoveDistance = 0;
        this.autoMoveTraveled = 0;
    }

    update(terrain, worms) {
        if (!this.alive) return;

        const wasGrounded = this.grounded;
        
        // Handle auto-movement
        if (this.autoMoveDistance > 0 && this.grounded) {
            this.move(this.autoMoveDirection, terrain);
            this.autoMoveTraveled += this.moveSpeed;
            if (this.autoMoveTraveled >= this.autoMoveDistance) {
                this.stopAutoMove();
            }
        }
        
        // Apply gravity
        if (!this.grounded) {
            this.velocityY += this.gravity;
            this.velocityY = Math.min(this.velocityY, 15); // Terminal velocity
        }
        
        // Apply horizontal velocity (for jumping)
        if (this.velocityX !== 0) {
            const newX = this.x + this.velocityX;
            // Check for wall collision
            if (!terrain.isSolid(newX, this.y - 10)) {
                this.x = newX;
            } else {
                this.velocityX = 0;
            }
            // Apply friction when grounded
            if (this.grounded) {
                this.velocityX *= 0.8;
                if (Math.abs(this.velocityX) < 0.1) this.velocityX = 0;
            }
        }
        
        // Track fall start for fall damage (only if not a voluntary jump)
        if (!wasGrounded && this.velocityY > 0 && this.fallStartY === null && !this.isJumping) {
            this.fallStartY = this.y;
        }

        // Move vertically
        this.y += this.velocityY;
        
        // Check ground collision - check at feet level (y position)
        this.grounded = false;
        if (terrain.isSolid(this.x, this.y) || 
            terrain.isSolid(this.x - this.width/2 + 2, this.y) ||
            terrain.isSolid(this.x + this.width/2 - 2, this.y)) {
            
            // Move up until not in ground
            while (terrain.isSolid(this.x, this.y - 1) && this.y > 0) {
                this.y--;
            }
            
            // Calculate fall damage (only for non-jump falls)
            if (this.fallStartY !== null && !this.isJumping) {
                const fallDistance = this.y - this.fallStartY;
                if (fallDistance > this.fallDamageThreshold) {
                    const damage = Math.floor((fallDistance - this.fallDamageThreshold) * 0.3);
                    this.takeDamage(damage);
                }
            }
            
            this.grounded = true;
            this.velocityY = 0;
            this.fallStartY = null;
            this.isJumping = false;
        }

        // Keep in bounds
        this.x = clamp(this.x, this.width/2, terrain.width - this.width/2);
        
        // Die if fallen off screen
        if (this.y > terrain.height + 100) {
            this.health = 0;
            this.alive = false;
        }
    }

    move(direction, terrain) {
        if (!this.grounded || !this.alive) return;
        
        const newX = this.x + direction * this.moveSpeed;
        
        // Check if we can move (not blocked by terrain)
        const headY = this.y - this.height;
        if (!terrain.isSolid(newX, headY) && 
            !terrain.isSolid(newX + direction * this.width/2, headY)) {
            
            // Can climb small steps
            let canMove = true;
            let targetY = this.y;
            
            // Check for step up
            for (let stepCheck = 0; stepCheck < 10; stepCheck++) {
                if (terrain.isSolid(newX, this.y + this.height - stepCheck)) {
                    targetY = this.y - stepCheck - 1;
                } else {
                    break;
                }
            }
            
            // Check if step is too high
            if (terrain.isSolid(newX, targetY - this.height)) {
                canMove = false;
            }
            
            if (canMove) {
                this.x = newX;
                this.y = targetY;
                this.facingRight = direction > 0;
            }
        }
    }

    aim(delta) {
        this.aimAngle += delta;
        this.aimAngle = clamp(this.aimAngle, -Math.PI, 0);
    }

    jump(direction = 0) {
        if (!this.grounded || !this.alive) return;
        
        // Forward jump - both vertical and horizontal velocity
        this.velocityY = -8; // Jump force (slightly less for forward arc)
        this.velocityX = direction * 5; // Horizontal velocity for forward jump
        this.grounded = false;
        this.facingRight = direction >= 0;
        this.isJumping = true; // Mark as voluntary jump (no fall damage)
        this.stopAutoMove(); // Stop any auto-movement
    }

    startAutoMove(direction, distance = 60) {
        this.autoMoveDirection = direction;
        this.autoMoveDistance = distance;
        this.autoMoveTraveled = 0;
        this.facingRight = direction > 0;
    }

    stopAutoMove() {
        this.autoMoveDirection = 0;
        this.autoMoveDistance = 0;
        this.autoMoveTraveled = 0;
    }

    isMoving() {
        return this.autoMoveDistance > 0;
    }

    takeDamage(amount) {
        if (!this.alive) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
    }

    applyExplosionForce(explosionX, explosionY, force) {
        const dx = this.x - explosionX;
        const dy = this.y - explosionY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;
        
        const pushX = (dx / dist) * force;
        const pushY = (dy / dist) * force;
        
        this.x += pushX;
        this.velocityY = pushY;
        this.grounded = false;
        this.fallStartY = this.y;
    }

    draw(ctx, isActive) {
        if (!this.alive) return;
        
        const x = Math.floor(this.x);
        const y = Math.floor(this.y);
        
        // Body color based on team
        const bodyColor = this.team === 'player' ? '#4ade80' : '#ef4444';
        const darkColor = this.team === 'player' ? '#22c55e' : '#dc2626';
        
        // Draw body (simple worm shape)
        ctx.fillStyle = bodyColor;
        
        // Body segments
        ctx.beginPath();
        ctx.ellipse(x, y - 8, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Darker belly
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.ellipse(x, y - 4, 8, 6, 0, 0, Math.PI);
        ctx.fill();
        
        // Eyes
        const eyeOffsetX = this.facingRight ? 3 : -3;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x + eyeOffsetX, y - 14, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(x + eyeOffsetX + (this.facingRight ? 1 : -1), y - 14, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Health bar
        const healthBarWidth = 30;
        const healthPercent = this.health / 100;
        ctx.fillStyle = '#333';
        ctx.fillRect(x - healthBarWidth/2, y - 30, healthBarWidth, 4);
        ctx.fillStyle = healthPercent > 0.5 ? '#4ade80' : healthPercent > 0.25 ? '#fbbf24' : '#ef4444';
        ctx.fillRect(x - healthBarWidth/2, y - 30, healthBarWidth * healthPercent, 4);
        
        // Name
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, x, y - 35);
        
        // Draw aim indicator if active
        if (isActive) {
            this.drawAimIndicator(ctx);
            
            // Selection indicator
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y - 8, 18, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    drawAimIndicator(ctx) {
        const aimLength = 35;
        const startX = this.x;
        const startY = this.y - 12;
        const endX = startX + Math.cos(this.aimAngle) * aimLength;
        const endY = startY + Math.sin(this.aimAngle) * aimLength;
        
        // Draw aim direction line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Arrow head
        const arrowSize = 10;
        const angle = this.aimAngle;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - arrowSize * Math.cos(angle - 0.4),
            endY - arrowSize * Math.sin(angle - 0.4)
        );
        ctx.lineTo(
            endX - arrowSize * Math.cos(angle + 0.4),
            endY - arrowSize * Math.sin(angle + 0.4)
        );
        ctx.closePath();
        ctx.fill();
    }
}
