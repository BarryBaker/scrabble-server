const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3000 });

const {
  hasIsolatedLetters,
  getNextPlayer,
  shuffle,
  remainingLetters,
  // broadcast,
} = require("./utils");
const { calculateScore } = require("./calcScore");
const { checkWordWithHunspell } = require("./hunspell");
const { Player } = require("./player");
const { allLetters, buildBoard, someUnconfirmed } = require("./gameTools");

let requiredPlayers = 2;
let players = [];
let playerInTurn = null;
let lastPacked = [];

shuffle(allLetters);

function fillLetters(player) {
  const playerLetters = allLetters.filter(
    (letter) => letter.place === `player-${player.name}`
  );
  const lettersToFill = 7 - playerLetters.length;
  const newLetters = allLetters
    .filter((letter) => letter.place === "bag")
    .slice(0, lettersToFill);
  newLetters.forEach((letter) => (letter.place = `player-${player.name}`));

  player.ws.send(
    JSON.stringify({
      type: "update-letters",
      letters: allLetters.filter(
        (letter) => letter.place === `player-${player.name}`
      ),
    })
  );
  broadcast({
    type: "remaining-letters",
    remainingLetters: remainingLetters(allLetters).length,
  });
}

function broadcast(data) {
  players.forEach((player) => {
    player.ws.send(JSON.stringify(data));
  });
}

function sendLetters() {
  players.forEach((player) => {
    player.ws.send(
      JSON.stringify({
        type: "update-letters",
        letters: allLetters.filter(
          (letter) => letter.place === `player-${player.name}`
        ),
      })
    );
  });
}
function packBackLetters(player) {
  allLetters.forEach((letter) => {
    if (letter.place.startsWith("board") && !letter.confirmed) {
      letter.place = `player-${player}`;
      if (letter.isWild) {
        letter.letter = "";
        letter.points = null;
      }
    }
  });

  broadcast({ type: "update-board", board: buildBoard(allLetters) });
  sendLetters();
}
function startGame() {
  // Deal letters
  players.forEach((player) => {
    fillLetters(player);
  });

  shuffle(players);
  const firstToAct = Math.floor(Math.random() * players.length);

  broadcast({ type: "start-game" });
  broadcast({ type: "turn", player: players[firstToAct].name });
  playerInTurn = players[firstToAct].name;

  broadcast({ type: "update-board", board: buildBoard(allLetters) });
}

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

function endGame(winner) {
  allLetters.forEach((letter) => {
    if (letter.place.startsWith("board")) {
      letter.confirmed = true;
    }
  });

  broadcast({ type: "update-board", board: buildBoard(allLetters) });

  const playersLetterPoints = players.map((player) => {
    const letterPoints = allLetters
      .filter((letter) => letter.place === `player-${player.name}`)
      .reduce((total, letter) => total + letter.points, 0);

    return {
      name: player.name,
      letterPoints: letterPoints,
    };
  });

  players.forEach((player) => {
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
    const winnerPlayer = players.find((p) => p.name === winner);
    winnerPlayer.score += totalRemainingPoints;
  }
  broadcast({
    type: "update-score",
    scores: players.reduce((acc, player) => {
      acc[player.name] = player.score;
      return acc;
    }, {}),
  });
  broadcast({
    type: "end-game",
  });
}

wss.on("connection", (ws) => {
  // console.log("aaaa");
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    const player = players.find((p) => p.name === data.player);

    switch (data.type) {
      case "join":
        if (!players.some((player) => player.ws === ws)) {
          const newName = data.name || `Player ${players.length + 1}`;

          const newPlayer = { name: newName, ws, score: 0, surrendered: false };
          players.push(newPlayer);
          newPlayer.ws.send(
            JSON.stringify({
              type: "new-player",
              name: newPlayer.name,
            })
          );

          if (players.length === requiredPlayers) {
            broadcast({
              type: "players",
              players: players.map((p) => p.name),
              requiredPlayers,
            });
            startGame();
          }
        }
        break;
      case "rejoin":
        // let rejoinedPlayer = players.find((p) => p.name === data.name);

        if (player) {
          // if (player.name == playerInTurn) {
          //   allLetters.forEach((letter) => {
          //     if (letter.place.startsWith("board") && !letter.confirmed) {
          //       letter.place = `player-${playerInTurn}`;
          //       if (letter.isWild) {
          //         letter.letter = "";
          //         letter.points = null;
          //       }
          //     }
          //   });
          // }
          // console.log(allLetters);
          player.ws = ws; // Reassign the WebSocket connection
          player.ws.send(
            JSON.stringify({
              type: "start-game",
            })
          );
          // rejoinedPlayer.ws.send(
          //   JSON.stringify({
          //     type: "new-player",
          //     name: rejoinedPlayer.name,
          //   })
          // );
          broadcast({
            type: "players",
            players: players.map((p) => p.name),
            requiredPlayers,
          });
          broadcast({ type: "update-board", board: buildBoard(allLetters) });
          // fillLetters(player);
          sendLetters();
          broadcast({
            type: "turn",
            player: playerInTurn,
          });
          broadcast({
            type: "update-score",
            scores: players.reduce((acc, player) => {
              acc[player.name] = player.score;
              return acc;
            }, {}),
          });
          broadcast({
            type: "lastpacked",
            lastPacked: lastPacked,
          });
          broadcast({
            type: "remaining-letters",
            remainingLetters: remainingLetters(allLetters).length,
          });
        } else {
          // Handle new player joining logic
        }
        break;
      case "cancel-turn":
        allLetters.forEach((letter) => {
          if (letter.place.startsWith("board") && !letter.confirmed) {
            letter.place = `player-${data.player}`;
            if (letter.isWild) {
              letter.letter = "";
              letter.points = null;
            }
          }
        });

        broadcast({ type: "update-board", board: buildBoard(allLetters) });
        sendLetters();
        break;

      case "turn":
        const boardSize = 15; // Assuming a 15x15 Scrabble board
        const newboard = Array.from({ length: boardSize }, () =>
          Array(boardSize).fill(null)
        );

        // Place the letters on the board
        const boardLetters = allLetters.filter((letter) =>
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
          allLetters.forEach((letter) => {
            if (letter.place.startsWith("board")) {
              letter.confirmed = true;
            }
          });

          broadcast({ type: "update-board", board: buildBoard(allLetters) });
          broadcast({
            type: "turn",
            player: getNextPlayer(data.player, players),
          });
          playerInTurn = getNextPlayer(data.player, players);
          fillLetters(player);
          // saveGameState(
          //   allLetters,
          //   players,
          //   getNextPlayer(data.player, players)
          // );
        }

        if (
          (classifiedWords.onlyConfirmed.length > 0 ||
            classifiedWords.mixed.length > 0) &&
          classifiedWords.onlyUnconfirmed.length > 0
        ) {
          packBackLetters(data.player);
          break;
        }
        if (hasIsolatedLetters(allLetters)) {
          packBackLetters(data.player);
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
            const invalidWords = allWords.filter(
              (word) => !validWords.includes(word)
            );

            if (validWords.length === allWords.length) {
              const score = calculateScore(goodWords);
              player.score += score;
              const unConfirmeLetters = allLetters.filter(
                (letter) =>
                  letter.place.startsWith("board") && !letter.confirmed
              );
              if (unConfirmeLetters.length === 7) {
                player.score += 50;
              }

              lastPacked = [...unConfirmeLetters];
              broadcast({
                type: "lastpacked",
                lastPacked: lastPacked,
              });

              broadcast({
                type: "update-score",
                scores: players.reduce((acc, player) => {
                  acc[player.name] = player.score;
                  return acc;
                }, {}),
              });

              //Check if game ends
              if (
                allLetters.filter(
                  (letter) => letter.place === `player-${data.player}`
                ).length === 0 &&
                allLetters.filter((letter) => letter.place === "bag").length ===
                  0
              ) {
                endGame(data.player);
              } else {
                continueGame();
              }
            } else {
              // console.log("Invalid words found: ", invalidWords);
              packBackLetters(data.player);
            }
          })
          .catch((error) => {
            console.error("Error during word validation: ", error);
          });
        break;

      case "update-board-cell":
        const { rowIndex, colIndex, id, desiredLetter } = data;
        const theLetter = allLetters.find((l) => l.id === Number(id));

        // Check if thers a letter there already
        if (
          allLetters.find((l) => l.place === `board-${rowIndex}-${colIndex}`)
        ) {
          break;
        }

        theLetter.place = `board-${rowIndex}-${colIndex}`;

        if (desiredLetter) {
          theLetter.points = allLetters.filter(
            (l) => l.letter === desiredLetter
          )[0].points;
          // console.log(
          //   theLetter,
          //   allLetters.filter((l) => l.letter === theLetter.letter)[0]
          // );
          theLetter.letter = desiredLetter;
          // console.log(theLetter);
          theLetter["isWid"] = true;
        }
        sendLetters();

        broadcast({ type: "update-board", board: buildBoard(allLetters) });

        break;
      case "change-all-letters":
        if (someUnconfirmed(allLetters)) {
          break;
        }

        allLetters.forEach((letter) => {
          if (letter.place === `player-${player.name}`) {
            letter.place = "bag";
          }
        });

        shuffle(allLetters);
        fillLetters(player);
        broadcast({
          type: "turn",
          player: getNextPlayer(data.player, players),
        });
        playerInTurn = getNextPlayer(data.player, players);
        break;
      case "shuffle":
        if (someUnconfirmed(allLetters)) {
          break;
        }
        const playerLetters = allLetters.filter(
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
        if (someUnconfirmed(allLetters)) {
          break;
        }
        const theplayer = players.find((p) => p.name === data.player);
        theplayer.surrendered = true;
        if (players.every((p) => p.surrendered)) {
          endGame();
          break;
        }

        broadcast({
          type: "turn",
          player: getNextPlayer(data.player, players),
        });
        playerInTurn = getNextPlayer(data.player, players);
        break;
    }
  });
});
// server.listen(3000, () => {
//   // console.log("Server is listening on port 3000");
// });
