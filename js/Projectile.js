// Bomb projectile

export class Projectile {
    constructor(x, y, velocityX, velocityY) {
        this.x = x;
        this.y = y;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.radius = 6;
        this.gravity = 0.3;
        this.explosionRadius = 50;
        this.damage = 35;
        this.active = true;
        this.rotation = 0;
        this.bounciness = 0.4;
        this.friction = 0.8;
        this.bounceCount = 0;
        this.maxBounces = 3;
        this.fuseTime = 180; // 3 seconds at 60fps
        this.hitWorm = false;
    }

    update(terrain, wind) {
        if (!this.active) return;

        // Apply wind
        this.velocityX += wind * 0.01;
        
        // Apply gravity
        this.velocityY += this.gravity;
        
        // Move
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        // Rotate for visual effect
        this.rotation += this.velocityX * 0.1;
        
        // Check terrain collision
        if (terrain.isSolid(this.x, this.y)) {
            // Simple bounce logic
            if (this.bounceCount < this.maxBounces) {
                // Find surface normal (simplified)
                const checkDist = 5;
                const solidLeft = terrain.isSolid(this.x - checkDist, this.y);
                const solidRight = terrain.isSolid(this.x + checkDist, this.y);
                const solidUp = terrain.isSolid(this.x, this.y - checkDist);
                const solidDown = terrain.isSolid(this.x, this.y + checkDist);
                
                if (solidDown && !solidUp) {
                    // Hit from above
                    this.velocityY = -Math.abs(this.velocityY) * this.bounciness;
                    this.velocityX *= this.friction;
                    this.y -= 2;
                } else if (solidUp && !solidDown) {
                    // Hit from below
                    this.velocityY = Math.abs(this.velocityY) * this.bounciness;
                } else if (solidLeft && !solidRight) {
                    // Hit from right
                    this.velocityX = Math.abs(this.velocityX) * this.bounciness;
                } else if (solidRight && !solidLeft) {
                    // Hit from left
                    this.velocityX = -Math.abs(this.velocityX) * this.bounciness;
                } else {
                    // Embedded in terrain - explode
                    this.fuseTime = 0;
                }
                
                this.bounceCount++;
                
                // Explode after max bounces
                if (this.bounceCount >= this.maxBounces) {
                    this.fuseTime = 0;
                }
                
                // Stop if velocity is very low
                if (Math.abs(this.velocityX) < 0.5 && Math.abs(this.velocityY) < 0.5) {
                    this.velocityX = 0;
                    this.velocityY = 0;
                }
            }
        }
        
        // Fuse countdown
        this.fuseTime--;
        
        // Check bounds
        if (this.x < -50 || this.x > terrain.width + 50 || this.y > terrain.height + 50) {
            this.active = false;
        }
    }

    shouldExplode() {
        return this.active && (this.fuseTime <= 0 || this.hitWorm);
    }

    checkWormCollision(worms) {
        for (const worm of worms) {
            if (!worm.alive) continue;
            const dx = this.x - worm.x;
            const dy = this.y - (worm.y - 12); // Center of worm
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.radius + 10) {
                this.hitWorm = true;
                return true;
            }
        }
        return false;
    }

    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Bomb body
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(-2, -2, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // Fuse
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(3, -this.radius - 5);
        ctx.stroke();
        
        // Spark
        if (this.fuseTime % 10 < 5) {
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(3, -this.radius - 6, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}
