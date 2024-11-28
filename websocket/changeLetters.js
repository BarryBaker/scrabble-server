const { getNextPlayer, shuffle } = require("../utils");
const { someUnconfirmed } = require("../gameTools");

function changeLetters(room, player) {
  if (someUnconfirmed(room.allLetters)) {
    return;
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
    player: getNextPlayer(player.name, room.players),
  });
  room.playerInTurn = getNextPlayer(player.name, room.players);
}

module.exports = {
  changeLetters,
};
