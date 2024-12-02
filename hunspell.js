const { exec } = require("child_process");

function checkWordWithHunspell(word, language = "hu_HU") {
  return new Promise((resolve, reject) => {
    exec(
      `echo "${word}" | hunspell -i UTF-8 -d /usr/local/share/hunspell/${language}`,
      // `echo "${word}" | hunspell -i UTF-8 -d ${language}`, // Notice the -d hu_HU (no full path needed)
      (error, stdout, stderr) => {
        if (error) {
          // console.log(word, stdout, "error");
          reject(error);
        } else {
          // console.log(word, stdout);
          const isCorrect = stdout.includes("*") || stdout.includes("+");
          resolve(isCorrect);
        }
      }
    );
  });
}
async function validateWords(words, lang) {
  const validWords = [];
  for (const word of words.slice(0, 1000)) {
    const isValid = await checkWordWithHunspell(word.toLowerCase(), lang);
    if (isValid) {
      validWords.push(word);
    }
  }

  return validWords;
}

module.exports = {
  validateWords,
  checkWordWithHunspell,
};
