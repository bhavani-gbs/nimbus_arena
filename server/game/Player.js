export class Player {
 constructor(id, username, x, y) {
 this.id = id;
 this.username = username;
 this.x = x;
 this.y = y;
 this.vx = 0;
 this.vy = 0;
 this.score = 0;
 this.input = { up: false, down: false, left: false, right: false };
 this.lastShot = 0;
 this.lastSequenceNumber = 0;
 this.speed = 200;
 }
 setInput(input) {
 this.input = input;
 }
 update(deltaTime, worldWidth, worldHeight) {
 // Calculate velocity based on input
 this.vx = 0;
 this.vy = 0;
 if (this.input.left) this.vx = -this.speed;
 if (this.input.right) this.vx = this.speed;
 if (this.input.up) this.vy = -this.speed;
 if (this.input.down) this.vy = this.speed;
 // Normalize diagonal movement
 if (this.vx !== 0 && this.vy !== 0) {
 this.vx *= 0.707;
 this.vy *= 0.707;
 }
 // Update position
 this.x += this.vx * deltaTime;
 this.y += this.vy * deltaTime;
// Keep in bounds
 this.x = Math.max(20, Math.min(worldWidth - 20, this.x));
 this.y = Math.max(20, Math.min(worldHeight - 20, this.y));
 }
 canShoot() {
 return Date.now() - this.lastShot > 500; // 0.5 second cooldown
 }
 respawn(worldWidth, worldHeight) {
 this.x = Math.random() * worldWidth;
 this.y = Math.random() * worldHeight;
 }
 }