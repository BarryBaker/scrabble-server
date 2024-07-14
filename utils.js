function hasIsolatedLetters(allLetters) {
  const boardSize = 15;
  const board = Array.from({ length: boardSize }, () =>
    Array(boardSize).fill(null)
  );

  // Place the letters on the board
  const boardLetters = allLetters.filter((letter) =>
    letter.place.startsWith("board")
  );
  for (let letterObj of boardLetters) {
    const [_, row, col] = letterObj.place.split("-");
    board[parseInt(row)][parseInt(col)] = letterObj;
  }

  // Check for isolated letters
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const letterObj = board[row][col];
      if (letterObj && !letterObj.confirmed) {
        const hasNeighbor =
          (row > 0 && board[row - 1][col]) ||
          (row < boardSize - 1 && board[row + 1][col]) ||
          (col > 0 && board[row][col - 1]) ||
          (col < boardSize - 1 && board[row][col + 1]);
        if (!hasNeighbor) {
          return true;
        }
      }
    }
  }
  return false;
}

function getNextPlayer(currentPlayerName, players) {
  const activePlayers = players.filter((player) => !player.surrendered);

  const currentIndex = activePlayers.findIndex(
    (player) => player.name === currentPlayerName
  );
  const nextIndex = (currentIndex + 1) % activePlayers.length;

  return activePlayers[nextIndex].name;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function remainingLetters(letters) {
  return letters.filter((letter) => letter.place === "bag");
}

module.exports = {
  hasIsolatedLetters,
  getNextPlayer,
  shuffle,
  remainingLetters,
  // broadcast,
};
