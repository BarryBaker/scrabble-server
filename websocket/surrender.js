const { getNextPlayer } = require("../utils");
const { someUnconfirmed } = require("../gameTools");

function surrender(room, player) {
  if (someUnconfirmed(room.allLetters)) {
    return;
  }
  player.surrendered = true;
  if (room.players.every((p) => p.surrendered)) {
    room.endGame();
    // removeRoomById(rooms, room.roomId);
    return;
  }

  room.broadcast({
    type: "turn",
    player: getNextPlayer(player.name, room.players),
  });
  room.playerInTurn = getNextPlayer(player.name, room.players);
}

module.exports = {
  surrender,
};
