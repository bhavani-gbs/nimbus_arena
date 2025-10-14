export class Player {
  constructor(id, username, x, y) {
    this.id = id;
    this.username = username;
    this.x = x;
    this.y = y;
    this.score = 0;
    this.input = { up: false, down: false, left: false, right: false };
    this.sequenceNumber = 0;
  }
}