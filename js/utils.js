// Utility functions

export function random(min, max) {
    return Math.random() * (max - min) + min;
}

export function randomInt(min, max) {
    return Math.floor(random(min, max + 1));
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function angleToTarget(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}
