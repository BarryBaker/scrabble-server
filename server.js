const WebSocket = require("ws");
const Game = require("./game");

const cors = require("cors");
const express = require("express");
const http = require("http");
const app = express();
app.use(cors());

const server = http.createServer(app); // Create HTTP server
const wss = new WebSocket.Server({ server }); // Attach WebSocket to HTTP server

const {
  hasIsolatedLetters,
  getNextPlayer,
  shuffle,
  remainingLetters,
  removeRoomById,
} = require("./utils");
const { calculateScore } = require("./calcScore");
const { checkWordWithHunspell } = require("./hunspell");
const {
  originalAllLetters,
  buildBoard,
  someUnconfirmed,
} = require("./gameTools");

const rooms = [];
app.get("/rooms", (req, res) => {
  res.json(rooms);
});

// Function to check words using hunspell
async function validateWords(words) {
  const validWords = [];
  for (const word of words) {
    const isValid = await checkWordWithHunspell(word.toLowerCase());
    if (isValid) {
      validWords.push(word);
    }
  }
  return validWords;
}

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    const room = rooms.find((r) => r.roomId === Number(data.roomId));

    const player = room
      ? room.players.find((p) => p.name === data.player)
      : null;
    const name = data.name;

    switch (data.type) {
      case "create-game":
        const roomId =
          rooms.reduce((max, room) => {
            return room.roomId > max ? room.roomId : max;
          }, 0) + 1;

        rooms.push(new Game(roomId, name || `Room ${roomId}`, data.playerCnt));
        ws.send(JSON.stringify({ type: "game-created" }));
        break;

      case "join":
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
          // fillLetters(player);
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
        const boardSize = 15; // Assuming a 15x15 Scrabble board
        const newboard = Array.from({ length: boardSize }, () =>
          Array(boardSize).fill(null)
        );

        // Place the letters on the board
        const boardLetters = room.allLetters.filter((letter) =>
          letter.place.startsWith("board")
        );
        for (let letterObj of boardLetters) {
          const [_, row, col] = letterObj.place.split("-");
          newboard[parseInt(row)][parseInt(col)] = {
            letter: letterObj.letter,
            confirmed: letterObj.confirmed,
            points: letterObj.points,
          };
        }
        // const newboard = buildBoard(allLetters);

        const words = [];

        function collectWordsInDirection(isHorizontal) {
          for (let i = 0; i < boardSize; i++) {
            let word = [];
            for (let j = 0; j < boardSize; j++) {
              const letterObj = isHorizontal ? newboard[i][j] : newboard[j][i];
              if (letterObj) {
                word.push({
                  ...letterObj,
                  row: isHorizontal ? i : j,
                  col: isHorizontal ? j : i,
                });
              } else if (word.length > 1) {
                words.push(word);
                word = [];
              } else {
                word = [];
              }
            }
            if (word.length > 1) {
              words.push(word);
            }
          }
        }
        collectWordsInDirection(true);
        collectWordsInDirection(false);

        const classifiedWords = {
          onlyConfirmed: [],
          mixed: [],
          onlyUnconfirmed: [],
        };

        for (let word of words) {
          const hasConfirmed = word.some((letter) => letter.confirmed);
          const hasUnconfirmed = word.some((letter) => !letter.confirmed);

          if (hasConfirmed && hasUnconfirmed) {
            classifiedWords.mixed.push(word);
          } else if (hasConfirmed) {
            classifiedWords.onlyConfirmed.push(word);
          } else {
            classifiedWords.onlyUnconfirmed.push(word);
          }
        }

        function continueGame() {
          room.allLetters.forEach((letter) => {
            if (letter.place.startsWith("board")) {
              letter.confirmed = true;
            }
          });

          room.broadcast({
            type: "update-board",
            board: buildBoard(room.allLetters),
          });
          room.broadcast({
            type: "turn",
            player: getNextPlayer(data.player, room.players),
          });
          room.playerInTurn = getNextPlayer(data.player, room.players);
          room.fillLetters(player);
        }

        if (
          (classifiedWords.onlyConfirmed.length > 0 ||
            classifiedWords.mixed.length > 0) &&
          classifiedWords.onlyUnconfirmed.length > 0
        ) {
          room.packBackLetters(data.player);
          break;
        }
        if (hasIsolatedLetters(room.allLetters)) {
          room.packBackLetters(data.player);
          break;
        }

        let goodWords = [];
        if (words.length === 1 && classifiedWords.onlyUnconfirmed.length > 0) {
          const containsMiddleCell = words[0].some(
            (letter) => letter.row === 7 && letter.col === 7
          );
          const isHorizontal = words[0].every((letter) => letter.row === 7);
          const startsAtMiddleAndGoesRight =
            words[0][0].row === 7 && words[0][0].col === 7;
          if (
            containsMiddleCell &&
            isHorizontal &&
            startsAtMiddleAndGoesRight
          ) {
            goodWords.push(words[0]);
          } else {
            packBackLetters(data.player);
            break;
          }
        } else {
          goodWords = [...classifiedWords.mixed];
        }

        const allWords = goodWords.map((word) =>
          word.map((letter) => letter.letter).join("")
        );

        validateWords(allWords)
          .then((validWords) => {
            // const invalidWords = allWords.filter(
            //   (word) => !validWords.includes(word)
            // );

            if (validWords.length === allWords.length) {
              const score = calculateScore(goodWords);
              player.score += score;
              const unConfirmeLetters = room.allLetters.filter(
                (letter) =>
                  letter.place.startsWith("board") && !letter.confirmed
              );
              if (unConfirmeLetters.length === 7) {
                player.score += 50;
              }

              room.lastPacked = [...unConfirmeLetters];
              room.broadcast({
                type: "lastpacked",
                lastPacked: room.lastPacked,
              });

              room.broadcast({
                type: "update-score",
                scores: room.players.reduce((acc, player) => {
                  acc[player.name] = player.score;
                  return acc;
                }, {}),
              });

              //Check if game ends
              if (
                room.allLetters.filter(
                  (letter) => letter.place === `player-${data.player}`
                ).length === 0 &&
                room.allLetters.filter((letter) => letter.place === "bag")
                  .length === 0
              ) {
                room.endGame(data.player);
                removeRoomById(rooms, room.roomId);
              } else {
                continueGame();
              }
            } else {
              // console.log("Invalid words found: ", invalidWords);
              room.packBackLetters(data.player);
            }
          })
          .catch((error) => {
            console.error("Error during word validation: ", error);
          });
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
        if (someUnconfirmed(room.allLetters)) {
          break;
        }

        room.allLetters.forEach((letter) => {
          if (letter.place === `player-${player.name}`) {
            letter.place = "bag";
          }
        });

        shuffle(room.allLetters);
        room.fillLetters(player);
        room.broadcast({
          type: "turn",
          player: getNextPlayer(data.player, room.players),
        });
        room.playerInTurn = getNextPlayer(data.player, room.players);
        break;
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
        if (someUnconfirmed(room.allLetters)) {
          break;
        }
        // const theplayer = players.find((p) => p.name === data.player);
        player.surrendered = true;
        if (room.players.every((p) => p.surrendered)) {
          room.endGame();
          removeRoomById(rooms, room.roomId);
          break;
        }

        room.broadcast({
          type: "turn",
          player: getNextPlayer(data.player, room.players),
        });
        room.playerInTurn = getNextPlayer(data.player, room.players);
        break;
      // case "new":
      //   requiredPlayers = data.playerCnt;
      //   players = [];
      //   playerInTurn = null;
      //   lastPacked = [];
      //   allLetters = JSON.parse(JSON.stringify(originalAllLetters));

      //   shuffle(allLetters);
      //   break;
    }
  });
});
server.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
