const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3000 });

let players = [];
let currentTurn = 0;
let letters = [];
let requiredPlayers = 2;

function initializeLetters() {
  letters = [
    { letter: "", points: 0, count: 2 },
    { letter: "A", points: 1, count: 6 },
    { letter: "E", points: 1, count: 6 },
    { letter: "K", points: 1, count: 6 },
    { letter: "T", points: 1, count: 5 },
    { letter: "Á", points: 1, count: 4 },
    { letter: "L", points: 1, count: 4 },
    { letter: "N", points: 1, count: 4 },
    { letter: "R", points: 1, count: 4 },
    { letter: "I", points: 1, count: 3 },
    { letter: "M", points: 1, count: 3 },
    { letter: "O", points: 1, count: 3 },
    { letter: "S", points: 1, count: 3 },
    { letter: "B", points: 2, count: 3 },
    { letter: "D", points: 2, count: 3 },
    { letter: "G", points: 2, count: 3 },
    { letter: "Ó", points: 2, count: 3 },
    { letter: "É", points: 3, count: 3 },
    { letter: "H", points: 3, count: 2 },
    { letter: "SZ", points: 3, count: 2 },
    { letter: "V", points: 3, count: 2 },
    { letter: "F", points: 4, count: 2 },
    { letter: "GY", points: 4, count: 2 },
    { letter: "J", points: 4, count: 2 },
    { letter: "Ö", points: 4, count: 2 },
    { letter: "P", points: 4, count: 2 },
    { letter: "U", points: 4, count: 2 },
    { letter: "Ü", points: 4, count: 2 },
    { letter: "Z", points: 4, count: 2 },
    { letter: "C", points: 5, count: 1 },
    { letter: "Í", points: 5, count: 1 },
    { letter: "NY", points: 5, count: 1 },
    { letter: "CS", points: 7, count: 1 },
    { letter: "Ő", points: 7, count: 1 },
    { letter: "Ú", points: 7, count: 1 },
    { letter: "Ű", points: 7, count: 1 },
    { letter: "LY", points: 8, count: 1 },
    { letter: "ZS", points: 8, count: 1 },
    { letter: "TY", points: 10, count: 1 },
  ];
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function dealLetters() {
  const allLetters = [];
  letters.forEach((letter) => {
    for (let i = 0; i < letter.count; i++) {
      allLetters.push({ letter: letter.letter, points: letter.points });
    }
  });

  shuffle(allLetters);

  players.forEach((player) => {
    player.letters = allLetters.splice(0, 7);
  });
}
function startGame() {
  initializeLetters();
  dealLetters();
  currentTurn = Math.floor(Math.random() * players.length);
  players.forEach((player, index) => {
    player.ws.send(
      JSON.stringify({ type: "start-game", letters: player.letters })
    );
  });
  broadcast({ type: "turn", player: players[currentTurn].name });
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
        break;
    }
  });
});
