// Destructible terrain using pixel data

export class Terrain {
    constructor(width, height, seed = null) {
        this.width = width;
        this.height = height;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        this.seed = seed;
        this.generate();
    }

    // Simple seeded random number generator
    seededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    generate() {
        const ctx = this.ctx;
        const { width, height } = this;
        
        // Use seeded random if seed provided
        const rng = this.seed !== null ? this.seededRandom(this.seed) : Math.random;
        
        // Clear with transparent
        ctx.clearRect(0, 0, width, height);
        
        // Generate terrain using simple sine waves
        ctx.fillStyle = '#8B4513'; // Brown dirt
        ctx.beginPath();
        ctx.moveTo(0, height);
        
        // Create hilly terrain
        const baseHeight = height * 0.6;
        const segments = 50;
        const segmentWidth = width / segments;
        
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            const y = baseHeight 
                + Math.sin(i * 0.3) * 50 
                + Math.sin(i * 0.7) * 30
                + Math.sin(i * 0.1) * 40;
            ctx.lineTo(x, y);
        }
        
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        
        // Add some variety with darker patches (evenly distributed, clipped to terrain)
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = '#6B3E0A';
        const patchCount = 10;
        const sectionWidth = (width - 100) / patchCount;
        for (let i = 0; i < patchCount; i++) {
            // Distribute patches evenly across the terrain width
            const x = 50 + i * sectionWidth + rng() * sectionWidth * 0.7;
            const y = baseHeight + 70 + rng() * (height - baseHeight - 90);
            const size = 20 + rng() * 35;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        
        // Add grass layer on top (covers the patches)
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            const y = baseHeight 
                + Math.sin(i * 0.3) * 50 
                + Math.sin(i * 0.7) * 30
                + Math.sin(i * 0.1) * 40;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Check if a point is solid terrain
    isSolid(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return y >= this.height; // Below canvas is solid
        }
        const pixel = this.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return pixel[3] > 0; // Check alpha channel
    }

    // Find the ground level at a given x position
    getGroundLevel(x) {
        for (let y = 0; y < this.height; y++) {
            if (this.isSolid(x, y)) {
                return y;
            }
        }
        return this.height;
    }

    // Destroy terrain in a circular area
    destroy(centerX, centerY, radius) {
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalCompositeOperation = 'source-over';
    }

    // Draw terrain to main canvas
    draw(ctx) {
        ctx.drawImage(this.canvas, 0, 0);
    }
}
