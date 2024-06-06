const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = [];
let currentTurn = 0;
let letters = [];
let requiredPlayers = 0;

const letterSet = [
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

const letterPool = letterSet.flatMap((item) => Array(item.count).fill(item));
wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "join":
        if (players.length === 0 && data.requiredPlayers) {
          requiredPlayers = data.requiredPlayers;
        }

        if (players.length < requiredPlayers) {
          const player = { name: data.name, ws };
          players.push(player);

          // Send the full list of players to the new player
          ws.send(
            JSON.stringify({
              type: "players",
              players: players.map((p) => p.name),
            })
          );

          // Notify existing players about the new player
          players.forEach((p) => {
            if (p.ws !== ws) {
              p.ws.send(
                JSON.stringify({ type: "new-player", name: data.name })
              );
            }
          });

          // Start the game if the player count reaches maxPvvlayers
          if (players.length === requiredPlayers) {
            shuffle(letterPool);

            players.forEach((p) => {
              p.letters = drawLetters(7);
              p.ws.send(
                JSON.stringify({ type: "start-game", letters: p.letters })
              );
            });
          }
        } else {
          ws.send(JSON.stringify({ type: "error", message: "Game is full" }));
        }
        break;

      case "leave":
        players = players.filter((p) => p.ws !== ws);
        players.forEach((p) =>
          p.ws.send(JSON.stringify({ type: "player-left", name: data.name }))
        );
        break;
    }
  });

  ws.on("close", () => {
    const player = players.find((p) => p.ws === ws);
    if (player) {
      players = players.filter((p) => p.ws !== ws);
      players.forEach((p) =>
        p.ws.send(JSON.stringify({ type: "player-left", name: player.name }))
      );
    }
  });
});
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function drawLetters(count) {
  return letterPool.splice(0, count);
}
server.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
