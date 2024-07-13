const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 3000 });
const { exec } = require("child_process");

let origi_board = require("./initialBoard");
let letters = require("./letters");
const { hasIsolatedLetters } = require("./utils");

let players = [];
let currentTurn = 0;

let requiredPlayers = 2;
// let remainingLetters = 101;

origi_board = JSON.parse(JSON.stringify(origi_board)); // Deep copy the initial board
letters = JSON.parse(JSON.stringify(letters)); // Deep copy the initial board

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

//Shuffle letters
for (let i = allLetters.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [allLetters[i], allLetters[j]] = [allLetters[j], allLetters[i]];
}

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

  broadcast({ type: "update-board", board: board });
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

  currentTurn = Math.floor(Math.random() * players.length);

  broadcast({ type: "start-game" });
  broadcast({ type: "turn", player: players[currentTurn].name });
  buildBoard();
  // broadcast({ type: "update-board", board: board });
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
wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "join":
        if (!players.some((player) => player.ws === ws)) {
          const newName = `Player ${players.length + 1}`;
          // console.log(newName);
          const newPlayer = { name: newName, ws };
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
            }
          }
        });
        buildBoard();
        sendLetters();
        break;

      case "turn":
        // Initialize the board
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
          };
        }

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

        // Collect horizontal and vertical words
        collectWordsInDirection(true);
        collectWordsInDirection(false);

        // console.log(words);

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
        // console.log(classifiedWords);

        function continueGame() {
          allLetters.forEach((letter) => {
            if (letter.place.startsWith("board")) {
              letter.confirmed = true;
            }
          });
          buildBoard();
          broadcast({ type: "turn", player: data.nextPlayer });

          const beforeTurnPlayer = players.find(
            (p) => p.name === data.beforePlayer
          );
          fillLetters(beforeTurnPlayer);
        }
        function packBackLetters() {
          allLetters.forEach((letter) => {
            if (letter.place.startsWith("board") && !letter.confirmed) {
              letter.place = `player-${data.beforePlayer}`;
              if (letter.isWild) {
                letter.letter = "";
              }
            }
          });
          buildBoard();
          sendLetters();
        }

        if (
          classifiedWords.onlyConfirmed.length === 0 &&
          classifiedWords.mixed.length === 0 &&
          classifiedWords.onlyUnconfirmed.length > 0
        ) {
          const ucwords = classifiedWords.onlyUnconfirmed.map((word) =>
            word.map((letter) => letter.letter).join("")
          );
          validateWords(ucwords)
            .then((validWords) => {
              const invalidWords = ucwords.filter(
                (word) => !validWords.includes(word)
              );

              if (validWords.length === ucwords.length) {
                continueGame();
              } else {
                console.log("Invalid words found: ", invalidWords);
                packBackLetters();
              }
            })
            .catch((error) => {
              console.error("Error during word validation: ", error);
            });
          break;
        }
        if (classifiedWords.onlyUnconfirmed.length > 0) {
          packBackLetters();
          break;
        }
        if (hasIsolatedLetters(allLetters)) {
          packBackLetters();
          break;
        }
        const mixedWords = classifiedWords.mixed.map((word) =>
          word.map((letter) => letter.letter).join("")
        );
        // Validate each word using hunspell
        validateWords(mixedWords)
          .then((validWords) => {
            const invalidWords = mixedWords.filter(
              (word) => !validWords.includes(word)
            );

            if (validWords.length === mixedWords.length) {
              continueGame();
            } else {
              console.log("Invalid words found: ", invalidWords);
              packBackLetters();
            }
          })
          .catch((error) => {
            console.error("Error during word validation: ", error);
          });
        // checkWordWithHunspell("ál").then((value) => {
        //   // console.log(value);
        // });

        break;

      case "update-board-cell":
        const { rowIndex, colIndex, id, desiredLetter } = data;
        // console.log(allLetters, id.type);
        // Find the active player and remove the letter from their letters array
        const theLetter = allLetters.find((l) => l.id === Number(id));

        theLetter.place = `board-${rowIndex}-${colIndex}`;
        if (desiredLetter) {
          theLetter.letter = desiredLetter;
          theLetter["isWid"] = true;
        }
        sendLetters();

        //Update board
        buildBoard();
        // const letters = allLetters.filter((letter) =>
        //   letter.place.startsWith("board")
        // );
        // for (let l of letters) {
        //   const splitted = l.place.split("-");
        //   board[splitted[1]][splitted[2]].letter = l.letter;
        //   board[splitted[1]][splitted[2]].points = l.points;
        // }
        // broadcast({ type: "update-board", board: board });
        break;
    }
  });
});
