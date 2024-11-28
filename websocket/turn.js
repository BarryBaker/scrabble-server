const { calculateScore } = require("../calcScore");
const { validateWords } = require("../hunspell");
const { getNextPlayer, removeRoomById } = require("../utils");
const { bot_put_letters } = require("../bot");
const { buildBoard } = require("../gameTools");
const { gather_words } = require("./turnUtils");

const boardSize = 15; // Assuming a 15x15 Scrabble board

function turn(room, player) {
  const { goodWords, allWords } = gather_words(room, player);

  validateWords(allWords, room.language)
    .then((validWords) => {
      console.log(allWords, validWords);

      if (validWords.length === allWords.length) {
        const score = calculateScore(goodWords);
        player.score += score;
        const unConfirmeLetters = room.allLetters.filter(
          (letter) => letter.place.startsWith("board") && !letter.confirmed
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
            (letter) => letter.place === `player-${player.name}`
          ).length === 0 &&
          room.allLetters.filter((letter) => letter.place === "bag").length ===
            0
        ) {
          room.endGame(player.name);
          removeRoomById(rooms, room.roomId);
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
          const nextplayer = getNextPlayer(player.name, room.players);
          room.broadcast({
            type: "turn",
            player: nextplayer,
          });
          room.playerInTurn = nextplayer;
          room.fillLetters(player);
          if (nextplayer === "bot") {
            bot_put_letters(room);
          }
        }
      } else {
        room.packBackLetters(player.name);
      }
    })
    .catch((error) => {
      console.error("Error during word validation: ", error);
    });
}

module.exports = {
  gather_words,
  turn,
};
