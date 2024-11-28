const { buildBoard } = require("./gameTools");
const { validateWords } = require("./hunspell");
const { gather_words } = require("./websocket/turnUtils");
const { surrender } = require("./websocket/surrender");
const { changeLetters } = require("./websocket/changeLetters");

const { exec } = require("child_process");
const { getNextPlayer, remainingLetters } = require("./utils");
const { calculateScore } = require("./calcScore");

function runPythonScript(board, letters, invalid, callback = null) {
  console.log(letters);
  const boardJson = JSON.stringify(board);
  const lettersJson = JSON.stringify(letters);
  const invalidJson = JSON.stringify(invalid);
  return new Promise((resolve, reject) => {
    exec(
      `python_app/venv/bin/python3 python_app/bot.py '${boardJson}' '${lettersJson}' '${invalidJson}'`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing Python script: ${error.message}`);
          reject(error); // Reject the promise if there's an error
          return;
        }
        if (stderr) {
          console.error(`Python${stderr}`);
          //   reject(new Error(stderr)); // Reject the promise if there's stderr output
          //   return;
        }
        resolve(stdout);
      }
    );
  });
}

async function bot_put_letters(room) {
  const botPlayer = room.players.find((p) => p.name === "bot");

  const convverted_board = buildBoard(room.allLetters).map((row) =>
    row.map((cell) => cell.letter || "")
  );
  const convverted_letters = room.allLetters
    .filter((letter) => letter.place === `player-bot`)
    .map((l) => l.letter || "");

  const nonparsedwords = await runPythonScript(
    convverted_board,
    convverted_letters,
    room.invalid
  );

  const words = JSON.parse(nonparsedwords);
  let onlyWords = words.map((word) => word[0]);
  //   const shuffled = [...onlyWords].sort(() => Math.random() - 0.5);
  onlyWords.sort((a, b) => b.length - a.length);
  function validateFewWords(fewWords) {
    validateWords(fewWords, "en_GB").then((validWords) => {
      console.log(validWords, fewWords);
      if (
        (validWords.length === 0) &
        (onlyWords.length <= 5) &
        (remainingLetters(room.allLetters) < 7)
      ) {
        surrender(room, botPlayer);
      } else if ((validWords.length === 0) & (onlyWords.length <= 5)) {
        changeLetters(room, botPlayer);
      } else if (validWords.length === 0) {
        onlyWords = onlyWords.slice(5);
        validateFewWords(onlyWords.slice(0, 5));
      } else {
        const longest = validWords.reduce((longest, currentWord) => {
          return currentWord.length > longest.length ? currentWord : longest;
        }, "");
        longest_word = words.find((word) => word[0] === longest);
        // console.log(longest_word, "got longest");

        for (l of longest_word[1]) {
          const the_letter = room.allLetters.find(
            (let) => (let.place === "player-bot") & (let.letter === l[0])
          );
          the_letter.place = `board-${l[1]}-${l[2]}`;
        }
        // Start 'websocket turn' process:
        const { goodWords, allWords } = gather_words(room, botPlayer);

        validateWords(allWords, room.language)
          .then((validWords) => {
            console.log(allWords, validWords);
            if (validWords.length === allWords.length) {
              const score = calculateScore(goodWords);
              botPlayer.score += score;
              const unConfirmeLetters = room.allLetters.filter(
                (letter) =>
                  letter.place.startsWith("board") && !letter.confirmed
              );
              if (unConfirmeLetters.length === 7) {
                botPlayer.score += 50;
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
                  (letter) => letter.place === `player-bot`
                ).length === 0 &&
                room.allLetters.filter((letter) => letter.place === "bag")
                  .length === 0
              ) {
                room.endGame(botPlayer.name);
                // removeRoomById(rooms, room.roomId);
              } else {
                room.allLetters.forEach((letter) => {
                  if (letter.place.startsWith("board")) {
                    letter.confirmed = true;
                  }
                });

                room.broadcast({
                  type: "update-board",
                  board: buildBoard(room.allLetters),
                });
                const nextplayer = getNextPlayer(botPlayer.name, room.players);
                room.broadcast({
                  type: "turn",
                  player: nextplayer,
                });
                room.playerInTurn = nextplayer;
                room.fillLetters(botPlayer);
                if (nextplayer === "bot") {
                  bot_put_letters(room);
                }
              }
            } else {
              room.packBackLetters(botPlayer.name);
              //   console.log(allWords, validWords);
              room.invalid = room.invalid.concat(
                allWords.filter((element) => !validWords.includes(element))
              );
              room.invalid = [...new Set(room.invalid)];
              console.log(room.invalid);
              bot_put_letters(room);
            }
          })
          .catch((error) => {
            console.error("Error during word validation: ", error);
          });
        // room.sendLetters();

        // room.broadcast({
        //   type: "update-board",
        //   board: buildBoard(room.allLetters),
        // });

        // turn(room, botPlayer);
      }
    });
  }
  validateFewWords(onlyWords.slice(0, 5));
}

module.exports = {
  bot_put_letters,
};
