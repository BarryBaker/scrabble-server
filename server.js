const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 3000 });
const { exec } = require("child_process");

let origi_board = require("./initialBoard");
let letters = require("./letters");
const { hasIsolatedLetters, getNextPlayer, shuffle } = require("./utils");
const { calculateScore } = require("./calcScore");

let players = [];
// let currentTurn = 0;

let requiredPlayers = 2;
// let remainingLetters = 101;
// console.log(letters);
// origi_board = JSON.parse(JSON.stringify(origi_board)); // Deep copy the initial board
// letters = JSON.parse(JSON.stringify(letters)); // Deep copy the initial board

const allLetters = [];
// Assign unique IDs to letters
let letterIdCounter = 1;
letters.forEach((letter) => {
  for (let i = 0; i < letter.count; i++) {
    allLetters.push({
      id: letterIdCounter++,
      letter: letter.letter,
      points: letter.points,
      place: "bag",
      confirmed: false,
      isWild: letter.letter === "",
    });
  }
});

shuffle(allLetters);

function remainingLetters() {
  const remainingLetters = allLetters.filter(
    (letter) => letter.place === "bag"
  ).length;
  broadcast({ type: "remaining-letters", remainingLetters });
}
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
  remainingLetters();
}

function checkWordWithHunspell(word) {
  return new Promise((resolve, reject) => {
    exec(
      `echo "${word}" | hunspell -d /usr/local/share/hunspell/hu_HU`,
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          // console.log(`Hunspell output for word "${word}":`, stdout, stderr);
          const isCorrect = stdout.includes("*") || stdout.includes("+");
          resolve(isCorrect);
        }
      }
    );
  });
}

function buildBoard() {
  const board = origi_board.map((row) =>
    row.map((cell) => ({
      letter: null,
      points: null,
      confirmed: null,
      text: cell,
    }))
  );

  const boardLetters = allLetters.filter((letter) =>
    letter.place.startsWith("board")
  );
  for (let letterObj of boardLetters) {
    const [_, row, col] = letterObj.place.split("-");

    board[parseInt(row)][parseInt(col)] = {
      letter: letterObj.letter,
      points: letterObj.isWild
        ? letters.filter((l) => l.letter === letterObj.letter)[0].points
        : letterObj.points,
      confirmed: letterObj.confirmed,
    };
  }
  return board;
  // broadcast({ type: "update-board", board: board });
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

function startGame() {
  // Deal letters
  players.forEach((player) => {
    fillLetters(player);
  });
  shuffle(players);
  const firstToAct = Math.floor(Math.random() * players.length);

  broadcast({ type: "start-game" });
  broadcast({ type: "turn", player: players[firstToAct].name });

  broadcast({ type: "update-board", board: buildBoard() });
}

function broadcast(data) {
  players.forEach((player) => {
    player.ws.send(JSON.stringify(data));
  });
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

  broadcast({ type: "update-board", board: buildBoard() });
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
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    const player = players.find((p) => p.name === data.player);

    switch (data.type) {
      case "join":
        // let player = players.find((p) => p.name === data.player);
        // console.log(player);
        if (!players.some((player) => player.ws === ws)) {
          const newName = data.name || `Player ${players.length + 1}`;
          // console.log(newName);
          const newPlayer = { name: newName, ws, score: 0, surrendered: false };
          players.push(newPlayer);
          newPlayer.ws.send(
            JSON.stringify({
              type: "new-player",
              name: newPlayer.name,
            })
          );

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

        broadcast({ type: "update-board", board: buildBoard() });
        sendLetters();
        break;

      case "turn":
        // const beforeTurnPlayer = players.find((p) => p.name === data.player);
        // Initialize the board
        // const newboard= buildBoard();
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
        const unconfirmedCount = boardLetters.filter(
          (letter) => !letter.confirmed
        ).length;

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

          broadcast({ type: "update-board", board: buildBoard() });
          broadcast({
            type: "turn",
            player: getNextPlayer(data.player, players),
          });
          fillLetters(player);
        }
        function packBackLetters() {
          allLetters.forEach((letter) => {
            if (letter.place.startsWith("board") && !letter.confirmed) {
              letter.place = `player-${data.player}`;
              if (letter.isWild) {
                letter.letter = "";
                letter.points = null;
              }
            }
          });

          broadcast({ type: "update-board", board: buildBoard() });
          sendLetters();
        }
        if (
          (classifiedWords.onlyConfirmed.length > 0 ||
            classifiedWords.mixed.length > 0) &&
          classifiedWords.onlyUnconfirmed.length > 0
        ) {
          packBackLetters();
          break;
        }
        if (hasIsolatedLetters(allLetters)) {
          packBackLetters();
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
            packBackLetters();
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
              if (unconfirmedCount === 7) {
                player.score += 50;
              }

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
              packBackLetters();
            }
          })
          .catch((error) => {
            console.error("Error during word validation: ", error);
          });
        break;

      case "update-board-cell":
        const { rowIndex, colIndex, id, desiredLetter } = data;
        // console.log(allLetters, id.type);
        // Find the active player and remove the letter from their letters array
        const theLetter = allLetters.find((l) => l.id === Number(id));

        theLetter.place = `board-${rowIndex}-${colIndex}`;
        if (desiredLetter) {
          theLetter.letter = desiredLetter;
          theLetter.points = letters.filter(
            (l) => l.letter === theLetter.letter
          )[0].points;
          theLetter["isWid"] = true;
        }
        sendLetters();

        broadcast({ type: "update-board", board: buildBoard() });

        break;
      case "change-all-letters":
        if (
          allLetters.some(
            (letter) => letter.place.startsWith("board") && !letter.confirmed
          )
        ) {
          break;
        }
        // const player = players.find((p) => p.name === data.player);
        // Return current player's letters to the bag
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
        break;
      case "shuffle":
        if (
          allLetters.some(
            (letter) => letter.place.startsWith("board") && !letter.confirmed
          )
        ) {
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
        if (
          allLetters.some(
            (letter) => letter.place.startsWith("board") && !letter.confirmed
          )
        ) {
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
        break;
    }
  });
});
