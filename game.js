const { calculateScore } = require("./calcScore");
const { checkWordWithHunspell } = require("./hunspell");
const { buildBoard, originalAllLetters } = require("./gameTools");
const { shuffle, remainingLetters, hasIsolatedLetters } = require("./utils");

class Game {
  constructor(roomId, roomName, requiredPlayers = 2) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.requiredPlayers = requiredPlayers;
    this.players = [];
    this.allLetters = JSON.parse(JSON.stringify(originalAllLetters));
    this.playerInTurn = null;
    this.lastPacked = [];
    shuffle(this.allLetters);
  }

  addPlayer(player) {
    this.players.push(player);
    if (this.players.length === requiredPlayers) {
      this.startGame();
    }
  }
  fillLetters(player) {
    const playerLetters = this.allLetters.filter(
      (letter) => letter.place === `player-${player.name}`
    );
    const lettersToFill = 7 - playerLetters.length;
    const newLetters = this.allLetters
      .filter((letter) => letter.place === "bag")
      .slice(0, lettersToFill);
    newLetters.forEach((letter) => (letter.place = `player-${player.name}`));
    player.ws.send(
      JSON.stringify({
        type: "update-letters",
        letters: this.allLetters.filter(
          (letter) => letter.place === `player-${player.name}`
        ),
      })
    );
    this.broadcast({
      type: "remaining-letters",
      remainingLetters: remainingLetters(this.allLetters).length,
    });
  }

  broadcast(data) {
    this.players.forEach((player) => {
      player.ws.send(JSON.stringify(data));
    });
  }
  sendLetters() {
    this.players.forEach((player) => {
      player.ws.send(
        JSON.stringify({
          type: "update-letters",
          letters: this.allLetters.filter(
            (letter) => letter.place === `player-${player.name}`
          ),
        })
      );
    });
  }
  startGame() {
    shuffle(this.players);

    this.players.forEach((player) => this.fillLetters(player));
    const firstToAct = Math.floor(Math.random() * this.players.length);
    this.playerInTurn = this.players[firstToAct].name;

    this.broadcast({ type: "start-game", roomId: this.roomId });
    this.broadcast({ type: "turn", player: this.players[firstToAct].name });
    this.playerInTurn = this.players[firstToAct].name;

    this.broadcast({
      type: "update-board",
      board: buildBoard(this.allLetters),
    });
    // return {
    //   firstPlayer: this.players[firstToAct].name,
    //   board: buildBoard(this.allLetters),
    // };
  }
  endGame(winner) {
    this.allLetters.forEach((letter) => {
      if (letter.place.startsWith("board")) {
        letter.confirmed = true;
      }
    });

    this.broadcast({
      type: "update-board",
      board: buildBoard(this.allLetters),
    });

    const playersLetterPoints = this.players.map((player) => {
      const letterPoints = this.allLetters
        .filter((letter) => letter.place === `player-${player.name}`)
        .reduce((total, letter) => total + letter.points, 0);

      return {
        name: player.name,
        letterPoints: letterPoints,
      };
    });

    this.players.forEach((player) => {
      const playerLetterPoints = playersLetterPoints.find(
        (p) => p.name === player.name
      ).letterPoints;
      player.score -= playerLetterPoints;
    });

    if (winner) {
      const totalRemainingPoints = playersLetterPoints.reduce(
        (sum, player) => sum + player.letterPoints,
        0
      );
      const winnerPlayer = this.players.find((p) => p.name === winner);
      winnerPlayer.score += totalRemainingPoints;
    }
    this.broadcast({
      type: "update-score",
      scores: this.players.reduce((acc, player) => {
        acc[player.name] = player.score;
        return acc;
      }, {}),
    });
    this.broadcast({
      type: "end-game",
    });
  }
  packBackLetters(playerName) {
    this.allLetters.forEach((letter) => {
      if (letter.place.startsWith("board") && !letter.confirmed) {
        letter.place = `player-${playerName}`;
        if (letter.isWild) {
          letter.letter = "";
          letter.points = null;
        }
      }
    });
    this.broadcast({
      type: "update-board",
      board: buildBoard(this.allLetters),
    });
    this.sendLetters();
  }

  //   validateWords(words) {
  //     return Promise.all(
  //       words.map((word) => checkWordWithHunspell(word.toLowerCase()))
  //     ).then((results) => results.every((isValid) => isValid));
  //   }

  saveState() {
    const state = {
      players: this.players,
      allLetters: this.allLetters,
      playerInTurn: this.playerInTurn,
      lastPacked: this.lastPacked,
    };
    fs.writeFileSync("game_state.json", JSON.stringify(state, null, 2));
  }

  restoreState() {
    const state = JSON.parse(fs.readFileSync("game_state.json", "utf8"));
    this.players = state.players;
    this.allLetters = state.allLetters;
    this.playerInTurn = state.playerInTurn;
    this.lastPacked = state.lastPacked;
  }
}

module.exports = Game;
