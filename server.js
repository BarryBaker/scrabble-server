const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = [];
const maxPlayers = 4;

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "join":
        if (players.length < maxPlayers) {
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

          // Start the game if the player count reaches maxPlayers
          if (players.length === maxPlayers) {
            players.forEach((p) =>
              p.ws.send(JSON.stringify({ type: "start-game" }))
            );
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

server.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
