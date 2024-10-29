const origi_board = require("./initialBoard");
let letters = require("./letters");

const originalAllLetters = {};
for (let lang of Object.keys(letters)) {
  originalAllLetters[lang] = [];
  let letterIdCounter = 1;
  letters[lang].forEach((letter) => {
    for (let i = 0; i < letter.count; i++) {
      originalAllLetters[lang].push({
        id: letterIdCounter++,
        letter: letter.letter,
        points: letter.points,
        place: "bag",
        confirmed: false,
        isWild: letter.letter === "",
      });
    }
  });
}
function buildBoard(allLetters) {
  const board = origi_board.map((row) =>
    row.map((cell) => ({
      id: null,
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
      id: letterObj.id,
      letter: letterObj.letter,
      points: letterObj.isWild
        ? allLetters.filter((l) => l.letter === letterObj.letter)[0].points
        : letterObj.points,
      confirmed: letterObj.confirmed,
    };
  }
  return board;
}

function someUnconfirmed(allLetters) {
  return allLetters.some(
    (letter) => letter.place.startsWith("board") && !letter.confirmed
  );
}

module.exports = {
  buildBoard,
  originalAllLetters,
  someUnconfirmed,
};
