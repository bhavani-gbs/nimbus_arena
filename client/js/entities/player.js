// Filled in: Client-side Player entity for rendering and local state
export class Player {
  constructor(scene, id, username, x, y, isLocal = false) {
    this.id = id;
    this.username = username;
    this.sprite = scene.add.circle(x, y, 15, isLocal ? 0x00ff00 : 0x3182ce);
    this.nameText = scene.add.text(x, y - 25, username, {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
  }

  update(x, y) {
    this.sprite.x = x;
    this.sprite.y = y;
    this.nameText.x = x;
    this.nameText.y = y - 25;
  }

  destroy() {
    this.sprite.destroy();
    this.nameText.destroy();
  }
}