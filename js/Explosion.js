// Visual explosion effect

export class Explosion {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.currentRadius = 0;
        this.alpha = 1;
        this.active = true;
        this.particles = [];
        
        // Create particles
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 / 20) * i + Math.random() * 0.5;
            const speed = 2 + Math.random() * 4;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 3 + Math.random() * 5,
                color: Math.random() > 0.5 ? '#ff6600' : '#ffcc00',
                life: 1
            });
        }
    }

    update() {
        if (!this.active) return;

        // Expand explosion
        if (this.currentRadius < this.maxRadius) {
            this.currentRadius += this.maxRadius * 0.2;
        } else {
            this.alpha -= 0.1;
        }

        // Update particles
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // gravity
            p.life -= 0.03;
            p.size *= 0.95;
        }

        this.particles = this.particles.filter(p => p.life > 0);

        if (this.alpha <= 0 && this.particles.length === 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        // Draw main explosion
        if (this.alpha > 0) {
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.currentRadius
            );
            gradient.addColorStop(0, `rgba(255, 255, 200, ${this.alpha})`);
            gradient.addColorStop(0.3, `rgba(255, 150, 0, ${this.alpha * 0.8})`);
            gradient.addColorStop(0.7, `rgba(255, 50, 0, ${this.alpha * 0.5})`);
            gradient.addColorStop(1, `rgba(100, 0, 0, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw particles
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}
