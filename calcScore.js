let board = require("./initialBoard");

function calculateScore(words) {
  let totalScore = 0;

  for (let word of words) {
    let wordScore = 0;
    let wordMultiplier = 1;

    for (let letter of word) {
      let letterScore = letter.points;
      const cellType = board[letter.row][letter.col];
      // console.log(letter);
      if (!letter.confirmed) {
        switch (cellType) {
          case "double-letter":
            letterScore *= 2;
            break;
          case "triple-letter":
            letterScore *= 3;
            break;
          case "double-word":
            wordMultiplier *= 2;
            break;
          case "triple-word":
            wordMultiplier *= 3;
            break;
        }
      }

      wordScore += letterScore;
    }

    wordScore *= wordMultiplier;
    totalScore += wordScore;
  }

  return totalScore;
}

module.exports = { calculateScore };
