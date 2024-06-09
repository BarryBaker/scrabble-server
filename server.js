const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 3000 });

let board = require("./initialBoard");
let letters = require("./letters");

let players = [];
let currentTurn = 0;

let requiredPlayers = 2;

board = JSON.parse(JSON.stringify(board)); // Deep copy the initial board
letters = JSON.parse(JSON.stringify(letters)); // Deep copy the initial board

board = board.map((row) =>
  row.map((cell) => ({
    letter: "",
    points: "",
    text: cell,
  }))
);

const allLetters = [];
letters.forEach((letter) => {
  for (let i = 0; i < letter.count; i++) {
    allLetters.push({ letter: letter.letter, points: letter.points });
  }
});

//Shuffle letters
for (let i = allLetters.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [allLetters[i], allLetters[j]] = [allLetters[j], allLetters[i]];
}

function dealLetters() {
  players.forEach((player) => {
    player.letters = allLetters.splice(0, 7);
  });
}

function fillLetters(player) {
  player.letters = allLetters
    .splice(0, 7 - player.letters.length)
    .concat(player.letters);
  player.ws.send(
    JSON.stringify({
      type: "update-letters",
      //   player: player,
      letters: player.letters,
    })
  );
}

function startGame() {
  dealLetters();

  currentTurn = Math.floor(Math.random() * players.length);
  players.forEach((player, index) => {
    player.ws.send(
      JSON.stringify({ type: "start-game", letters: player.letters })
    );
  });
  broadcast({ type: "turn", player: players[currentTurn].name });
  broadcast({ type: "update-board", board: board });
}

function broadcast(data) {
  players.forEach((player) => {
    player.ws.send(JSON.stringify(data));
  });
}

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "join":
        if (!players.some((player) => player.name === data.name)) {
          players.push({ name: data.name, ws });
          if (players.length === 1) {
            requiredPlayers = data.requiredPlayers || 2;
          }
          broadcast({
            type: "players",
            players: players.map((p) => p.name),
            requiredPlayers,
          });
          if (players.length === requiredPlayers) {
            startGame();
          }
        }
        break;

      case "turn":
        currentTurnPlayer = data.player;
        broadcast({ type: "turn", player: currentTurnPlayer });

        const beforeTurnPlayer = players.find(
          (p) => p.name === data.beforePlayer
        );

        fillLetters(beforeTurnPlayer);
        break;

      case "update-board-cell":
        const { rowIndex, colIndex, updatedCell, letter, player } = data;
        board[rowIndex][colIndex] = updatedCell;
        broadcast({ type: "update-board", board });

        // Find the active player and remove the letter from their letters array
        const activePlayer = players.find((p) => p.name === player);
        if (activePlayer) {
          activePlayer.letters = activePlayer.letters.filter(
            (l) => l.letter !== letter
          );
        }
        activePlayer.ws.send(
          JSON.stringify({
            type: "update-letters",
            //   player: player,
            letters: activePlayer.letters,
          })
        );
        break;
    }
  });
});
