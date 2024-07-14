const origi_board = require("./initialBoard");
let letters = require("./letters");

const allLetters = [];
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

function buildBoard(allLetters) {
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
}

function someUnconfirmed(allLetters) {
  return allLetters.some(
    (letter) => letter.place.startsWith("board") && !letter.confirmed
  );
}
module.exports = {
  buildBoard,
  allLetters,
  someUnconfirmed,
};
