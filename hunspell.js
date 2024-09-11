const { exec } = require("child_process");

function checkWordWithHunspell(word) {
  return new Promise((resolve, reject) => {
    exec(
      // `echo "${word}" | hunspell -d /usr/local/share/hunspell/hu_HU`,
      `echo "${word}" | hunspell -d hu_HU`, // Notice the -d hu_HU (no full path needed)
      (error, stdout, stderr) => {
        if (error) {
          // console.log("a", stderr);aaaaaaajo
          reject(error);
        } else {
          // console.log("b", stdout);
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
