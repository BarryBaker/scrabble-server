const { exec } = require("child_process");

function checkWordWithHunspell(word, language = "hu_HU") {
  return new Promise((resolve, reject) => {
    exec(
      // `echo "${word}" | hunspell -i UTF-8 -d /usr/local/share/hunspell/${language}`,
      `echo "${word}" | hunspell -i UTF-8 -d ${language}`, // Notice the -d hu_HU (no full path needed)
      (error, stdout, stderr) => {
        if (error) {
          console.log(word, stdout, "error");
          reject(error);
        } else {
          console.log(word, stdout, "joo");
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
