const fs = require("fs");

// Read .dic file and extract root words
function extractWordsFromDic(dicFilePath) {
  const fileContent = fs.readFileSync(dicFilePath, "utf-8");
  const lines = fileContent.split("\n").slice(1); // Ignore first line (word count)

  const words = [];
  for (let line of lines) {
    if (line.trim()) {
      // if (index === 2000) {
      //   console.log(line.split(""));
      // }
      const rootWord = line.split("/")[0].split("\t")[0]; // Get root word before flag
      if (
        (rootWord[0] === rootWord[0].toLowerCase()) &
        (rootWord.length < 10) &
        (rootWord.length > 1)
      ) {
        words.push(rootWord);
      }
    }
  }
  return words;
}

// Example usage
const words = extractWordsFromDic("/usr/local/share/hunspell/hu_HU.dic");
// console.log(words.length);
// console.log(words[40004]);

const fileContent = fs.readFileSync(
  "/usr/local/share/hunspell/hu_HU.aff",
  "utf-8"
);
const lines = fileContent.split("\n").slice(1); // Ignore first line (word count)
const allwords = [];
for (let l of lines) {
  for (let i of l.split(" ")) {
    if ((i.startsWith("st") | i.startsWith("al")) & !i.includes("-")) {
      const rootWord = i.split(":")[1];
      if (rootWord != undefined) {
        if (
          (rootWord[0] === rootWord[0].toLowerCase()) &
          (rootWord.length < 10) &
          (rootWord.length > 1) &
          !allwords.includes(rootWord)
        ) {
          allwords.push(rootWord);
        }
      }
    }
  }
}
const allWrods = allwords.concat(words);

function canFormWord(word, availableLetters) {
  // Create a frequency map for available letters
  const letterMap = availableLetters.reduce((map, letter) => {
    map[letter] = (map[letter] || 0) + 1;
    return map;
  }, {});

  // Check if the word can be formed
  for (let letter of word) {
    if (!letterMap[letter] || letterMap[letter] === 0) {
      return false; // Not enough letters or letter not available
    }
    letterMap[letter]--; // Use one letter
  }

  return true; // Word can be formed
}

function filterWords(wordsList, availableLetters) {
  // Filter words that can be formed with the given letters
  return wordsList.filter((word) => canFormWord(word, availableLetters));
}
console.log(allWrods.includes("m"));
console.log(filterWords(allWrods, ["r", "e", "t", "zs", "o", "m", "gy"]));
// function parseAffixFile(affFilePath) {
//   const affixData = fs.readFileSync(affFilePath, "utf-8").split("\n");
//   const affixRules = {};

//   affixData.forEach((line) => {
//     const parts = line.split(/\s+/);
//     if (parts[0] === "SFX" || parts[0] === "PFX") {
//       const type = parts[0]; // SFX (suffix) or PFX (prefix)
//       const ruleName = parts[1]; // Rule name (e.g., A)
//       const strip = parts[2]; // The part of the word to strip (or 0 if none)
//       const affix = parts[3]; // The affix to apply
//       const condition = parts[4]; // Condition (e.g., pattern matching)

//       if (!affixRules[ruleName]) {
//         affixRules[ruleName] = [];
//       }
//       affixRules[ruleName].push({
//         type,
//         strip,
//         affix,
//         condition,
//       });
//     }
//   });

//   return affixRules;
// }

// // Example usage
// const affixRules = parseAffixFile("/usr/local/share/hunspell/hu_HU.aff");
// // console.log(affixRules["n"]);
// console.log(Object.keys(affixRules));

// function applyAffixesToWord(rootWord, affixRules) {
//   let wordForms = [rootWord]; // Start with the root word

//   // Iterate through each affix rule
//   // console.log(affixRules);
//   Object.keys(affixRules).forEach((ruleName) => {
//     affixRules[ruleName].forEach((rule) => {
//       // console.log(rule);
//       const { type, strip, affix, condition } = rule;
//       console.log(rule);
//       // Check if the word satisfies the condition (using regex)
//       const regexCondition = condition ? condition : ".*"; // Match everything if condition is undefined

//       const regex = new RegExp(regexCondition.replace("-", "\\-"));
//       if (regex.test(rootWord)) {
//         let modifiedWord = rootWord;

//         // Apply stripping if necessary
//         if (strip !== "0") {
//           const stripRegex = new RegExp(`${strip}$`);
//           modifiedWord = modifiedWord.replace(stripRegex, "");
//           modifiedWord = modifiedWord.split("/")[0];
//         }

//         // Add the prefix or suffix
//         if (type === "SFX") {
//           modifiedWord += affix; // Add suffix
//         } else if (type === "PFX") {
//           modifiedWord = affix + modifiedWord; // Add prefix
//         }
//         console.log(modifiedWord);
//         wordForms.push(modifiedWord);
//       }
//     });
//   });

//   return wordForms;
// }

// // Example usage
// const rootWord = "alma";
// const affixForms = applyAffixesToWord(rootWord, affixRules);
// console.log(affixForms);
checkWordWithHunspell("tb").then((e) => {
  console.log(e);
});
