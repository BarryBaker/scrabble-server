const { exec } = require("child_process");

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

module.exports = {
  checkWordWithHunspell,
};
