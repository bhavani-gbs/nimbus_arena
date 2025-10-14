export class GameLogic {
  constructor() {
    this.collisionRadius = 20;
  }

  checkCollision(obj1, obj2, radius) {
    const dist = Math.sqrt(
      Math.pow(obj1.x - obj2.x, 2) + 
      Math.pow(obj1.y - obj2.y, 2)
    );
    return dist < radius;
  }

  calculateScore(action) {
    const scores = {
      hit: 10,
      kill: 25,
      survival: 1
    };
    return scores[action] || 0;
  }
}