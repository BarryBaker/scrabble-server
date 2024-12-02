const WebSocket = require("ws");
const Game = require("./game");
// import { exec } from 'child_process';

const cors = require("cors");
const express = require("express");
const http = require("http");
const app = express();
app.use(cors());

const server = http.createServer(app); // Create HTTP server
const wss = new WebSocket.Server({ server }); // Attach WebSocket to HTTP server

const {
  getNextPlayer,
  shuffle,
  remainingLetters,
  removeRoomById,
} = require("./utils");

const { buildBoard, someUnconfirmed } = require("./gameTools");
const { turn } = require("./websocket/turn");
const { surrender } = require("./websocket/surrender");

const { changeLetters } = require("./websocket/changeLetters");

const { bot_put_letters } = require("./bot");
const { checkWordWithHunspell } = require("./hunspell");
// Call the Python script

const rooms = [];
app.get("/rooms", (req, res) => {
  res.json(rooms);
});

// Function to check words using hunspell

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    // console.log(data);
    const room = rooms.find((r) => r.roomId === Number(data.roomId));

    const player = room
      ? room.players.find((p) => p.name === data.player)
      : null;
    const name = data.name;

    const roomId =
      rooms.reduce((max, room) => {
        return room.roomId > max ? room.roomId : max;
      }, 0) + 1;

    switch (data.type) {
      case "create-solo-game":
        if (name === "bot") {
          break;
        }
        new_solo_room = new Game(roomId, name || `Room ${roomId}`, 2, "en_GB");
        rooms.push(new_solo_room);

        const solo_player = {
          name: name || `Player`,
          ws,
          score: 0,
          surrendered: false,
        };

        new_solo_room.players.push(solo_player);
        new_solo_room.players.push({
          name: "bot",
          ws: null,
          score: 0,
          surrendered: false,
        });
        solo_player.ws.send(
          JSON.stringify({
            type: "new-player",
            name: solo_player.name,
            roomId: new_solo_room.roomId,
          })
        );

        new_solo_room.broadcast({
          type: "players",
          players: new_solo_room.players.map((p) => p.name),
        });
        new_solo_room.startGame();

        ws.send(JSON.stringify({ type: "game-created" }));

        if (new_solo_room.playerInTurn === "bot") {
          const bp = new_solo_room.players.find((p) => p.name === "bot");

          bot_put_letters(new_solo_room);
        }
        break;

      case "create-game":
        rooms.push(
          new Game(roomId, name || `Room ${roomId}`, data.playerCnt, data.lang)
        );
        ws.send(JSON.stringify({ type: "game-created" }));
        break;

      case "join":
        if (name === "bot") {
          break;
        }
        const newPlayer = {
          name: name || `Player ${room.players.length + 1}`,
          ws,
          score: 0,
          surrendered: false,
        };

        room.players.push(newPlayer);
        newPlayer.ws.send(
          JSON.stringify({
            type: "new-player",
            name: newPlayer.name,
            roomId: room.roomId,
          })
        );

        if (room.players.length === room.requiredPlayers) {
          room.broadcast({
            type: "players",
            players: room.players.map((p) => p.name),
          });
          room.startGame();
        }

        break;
      case "reconnect":
        if (player) {
          player.ws = ws; // Reassign the WebSocket connectionn

          player.ws.send(
            JSON.stringify({
              type: "start-game",
              roomId: room.roomId,
            })
          );

          room.broadcast({
            type: "players",
            players: room.players.map((p) => p.name),
            requiredPlayers: room.requiredPlayers,
          });
          room.broadcast({
            type: "update-board",
            board: buildBoard(room.allLetters),
          });

          room.sendLetters();
          room.broadcast({
            type: "turn",
            player: room.playerInTurn,
          });
          room.broadcast({
            type: "update-score",
            scores: room.players.reduce((acc, player) => {
              acc[player.name] = player.score;
              return acc;
            }, {}),
          });
          room.broadcast({
            type: "lastpacked",
            lastPacked: room.lastPacked,
          });
          room.broadcast({
            type: "remaining-letters",
            remainingLetters: remainingLetters(room.allLetters).length,
          });
        } else {
          // Handle new player joining logic
        }
        break;
      case "cancel-turn":
        room.allLetters.forEach((letter) => {
          if (letter.place.startsWith("board") && !letter.confirmed) {
            letter.place = `player-${data.player}`;
            if (letter.isWild) {
              letter.letter = "";
              letter.points = null;
            }
          }
        });

        room.broadcast({
          type: "update-board",
          board: buildBoard(room.allLetters),
        });
        room.sendLetters();
        break;

      case "turn":
        turn(room, player);
        break;

      case "update-board-cell":
        const { rowIndex, colIndex, id, desiredLetter } = data;
        const theLetter = room.allLetters.find((l) => l.id === Number(id));

        // Check if thers a letter there already
        if (
          room.allLetters.find(
            (l) => l.place === `board-${rowIndex}-${colIndex}`
          )
        ) {
          break;
        }

        theLetter.place = `board-${rowIndex}-${colIndex}`;

        if (desiredLetter) {
          theLetter.points = room.allLetters.filter(
            (l) => l.letter === desiredLetter
          )[0].points;

          theLetter.letter = desiredLetter;

          theLetter["isWid"] = true;
        }
        room.sendLetters();

        room.broadcast({
          type: "update-board",
          board: buildBoard(room.allLetters),
        });

        break;
      case "change-all-letters":
        changeLetters(room, player);

        if (room.playerInTurn === "bot") {
          bot_put_letters(room);
        }

      case "shuffle":
        if (someUnconfirmed(room.allLetters)) {
          break;
        }
        const playerLetters = room.allLetters.filter(
          (letter) => letter.place === `player-${player.name}`
        );

        shuffle(playerLetters);
        player.ws.send(
          JSON.stringify({
            type: "update-letters",
            letters: playerLetters,
          })
        );
        break;
      case "surrender":
        surrender(room, player);
        if (room.playerInTurn === "bot") {
          bot_put_letters(room);
        }
    }
  });
});
server.listen(3000, () => {
  console.log("Server is listening on port 3000");
});

checkWordWithHunspell("ng", "en_GB").then((e) => {
  console.log(e);
});
