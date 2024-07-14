class Player {
  constructor(name, ws) {
    this.name = name;
    this.ws = ws;
    this.score = 0;
    this.surrendered = false;
  }

  addScore(points) {
    this.score += points;
  }
}

module.exports = { Player };
