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
        this.fuseTime = 300; // 5 seconds max flight time
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
        
        // Check terrain collision - explode on first contact
        // Check terrain collision - explode on first contact
        if (terrain.isSolid(this.x, this.y)) {
            this.fuseTime = 0; // Explode immediately
        }
        
        // Fuse countdown
        this.fuseTime--;
        
        // Check bounds
        if (this.x < -50 || this.x > terrain.width + 50 || this.y > terrain.height + 50) {
            this.active = false;
        }
    }

    shouldExplode() {
        return this.active && this.fuseTime <= 0;
    }

    checkWormCollision(worms) {
        for (const worm of worms) {
            if (!worm.alive) continue;
            const dx = this.x - worm.x;
            const dy = this.y - (worm.y - 12); // Center of worm
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.radius + 10) {
                this.fuseTime = 0; // Explode on worm hit
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
