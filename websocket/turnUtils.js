const { hasIsolatedLetters } = require("../utils");

const boardSize = 15; // Assuming a 15x15 Scrabble board

function collectWordsInDirection(newboard, isHorizontal) {
  const words = [];
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
  return words;
}

function gather_words(room, player) {
  const newboard = Array.from({ length: boardSize }, () =>
    Array(boardSize).fill(null)
  );
  // Place the letters on the board
  const boardLetters = room.allLetters.filter((letter) =>
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

  const words = collectWordsInDirection(newboard, true).concat(
    collectWordsInDirection(newboard, false)
  );

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

  if (
    (classifiedWords.onlyConfirmed.length > 0 ||
      classifiedWords.mixed.length > 0) &&
    classifiedWords.onlyUnconfirmed.length > 0
  ) {
    room.packBackLetters(player.name);
    return;
  }
  if (hasIsolatedLetters(room.allLetters)) {
    room.packBackLetters(player.name);
    return;
  }

  let goodWords = [];
  if (words.length === 1 && classifiedWords.onlyUnconfirmed.length > 0) {
    const containsMiddleCell = words[0].some(
      (letter) => letter.row === 7 && letter.col === 7
    );
    const isHorizontal = words[0].every((letter) => letter.row === 7);
    const startsAtMiddleAndGoesRight =
      words[0][0].row === 7 && words[0][0].col === 7;
    if (containsMiddleCell && isHorizontal && startsAtMiddleAndGoesRight) {
      goodWords.push(words[0]);
    } else {
      packBackLetters(player.name);
      return;
    }
  } else {
    goodWords = [...classifiedWords.mixed];
  }
  const allWords = goodWords.map((word) =>
    word.map((letter) => letter.letter).join("")
  );
  return { goodWords, allWords };
}

module.exports = {
  gather_words,
};
