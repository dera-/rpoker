window.gLocalAssetContainer["roleJudge"] = function(g) { (function(exports, require, module, __filename, __dirname) {
"use strict";

function parseWordList(text) {
  return text.split(/\r?\n/).map(line => line.trim()).filter(line => line && line.charAt(0) !== "#");
}
function buildWordInfoMap(cardWords, normalWords, specialWords0, specialWords1, specialWords2, specialWords3, specialWords4, handSize) {
  const map = {};
  const maxHandSize = handSize == null ? 7 : handSize;
  const uniqueCards = Array.from(new Set(cardWords)).sort((a, b) => b.length - a.length);
  const cardCountMemo = {};
  const countCards = word => {
    if (cardCountMemo[word] !== undefined) {
      return cardCountMemo[word];
    }
    const memo = {};
    const dfs = index => {
      if (index === word.length) {
        return 0;
      }
      if (memo[index] !== undefined) {
        return memo[index];
      }
      let best = null;
      for (let i = 0; i < uniqueCards.length; i++) {
        const token = uniqueCards[i];
        if (!word.startsWith(token, index)) {
          continue;
        }
        const rest = dfs(index + token.length);
        if (rest == null) {
          continue;
        }
        const current = rest + 1;
        if (best == null || current < best) {
          best = current;
        }
      }
      memo[index] = best;
      return best;
    };
    const result = dfs(0);
    cardCountMemo[word] = result;
    return result;
  };
  const toEntries = list => {
    const entries = [];
    for (let i = 0; i < list.length; i++) {
      const c = countCards(list[i]);
      if (c != null && c <= maxHandSize) {
        entries.push({
          word: list[i],
          cards: c
        });
      }
    }
    return entries;
  };
  const categoryEntries = {
    1: toEntries(specialWords1),
    2: toEntries(specialWords2),
    3: toEntries(specialWords3),
    4: toEntries(specialWords4)
  };
  const addWordInfo = (word, bonus, multiplier) => {
    const current = map[word];
    if (!current || bonus > current.bonus || bonus === current.bonus && multiplier > current.multiplier) {
      map[word] = {
        bonus: bonus,
        multiplier: multiplier
      };
    }
  };
  for (let i = 0; i < normalWords.length; i++) {
    addWordInfo(normalWords[i], 0, 1);
  }
  for (let i = 0; i < specialWords0.length; i++) {
    addWordInfo(specialWords0[i], 1, 2);
  }
  const specialGroups = [specialWords1, specialWords2, specialWords3, specialWords4];
  for (let gIndex = 0; gIndex < specialGroups.length; gIndex++) {
    const group = specialGroups[gIndex];
    for (let i = 0; i < group.length; i++) {
      addWordInfo(group[i], 1, 1);
    }
  }
  const addComboRecursive = (pattern, index, currentWord, currentCards) => {
    if (index >= pattern.length) {
      addWordInfo(currentWord, 1, 1);
      return;
    }
    const list = categoryEntries[pattern[index]];
    for (let i = 0; i < list.length; i++) {
      const nextCards = currentCards + list[i].cards;
      if (nextCards > maxHandSize) {
        continue;
      }
      addComboRecursive(pattern, index + 1, currentWord + list[i].word, nextCards);
    }
  };
  const basePatterns = [[1, 1], [1, 2], [1, 2, 3], [1, 2, 3, 4], [2, 3], [2, 3, 4], [3, 4], [1, 4], [2, 4], [1, 3]];
  for (let i = 0; i < basePatterns.length; i++) {
    addComboRecursive(basePatterns[i], 0, "", 0);
  }
  const sw1PrefixPatterns = [[1, 1], [1, 1, 1]];
  const suffixPatterns = [[], [2], [3], [4], [2, 3], [2, 3, 4], [3, 4], [2, 4]];
  for (let i = 0; i < sw1PrefixPatterns.length; i++) {
    for (let j = 0; j < suffixPatterns.length; j++) {
      addComboRecursive(sw1PrefixPatterns[i].concat(suffixPatterns[j]), 0, "", 0);
    }
  }
  return map;
}
function getMatches(handWords, wordInfoMap) {
  const matchesByStart = [];
  for (let i = 0; i < handWords.length; i++) {
    matchesByStart[i] = [];
    let joined = "";
    for (let j = i; j < handWords.length; j++) {
      joined += handWords[j];
      const info = wordInfoMap[joined];
      if (info != null) {
        const cardCount = j - i + 1;
        const score = info.multiplier * Math.pow(10, cardCount + info.bonus);
        matchesByStart[i].push({
          start: i,
          end: j,
          word: joined,
          score: score
        });
      }
    }
  }
  return matchesByStart;
}
function computeScore(wordsArray, wordInfoMap) {
  const matchesByStart = getMatches(wordsArray, wordInfoMap);
  const n = wordsArray.length;
  const dp = new Array(n + 1).fill(0);
  const choice = new Array(n).fill(null);
  for (let i = n - 1; i >= 0; i--) {
    let bestScore = dp[i + 1];
    let bestChoice = null;
    const matches = matchesByStart[i];
    for (let m = 0; m < matches.length; m++) {
      const match = matches[m];
      const score = match.score + dp[match.end + 1];
      if (score > bestScore) {
        bestScore = score;
        bestChoice = match;
      }
    }
    dp[i] = bestScore;
    choice[i] = bestChoice;
  }
  const chosenMatches = [];
  let index = 0;
  while (index < n) {
    if (choice[index]) {
      const match = choice[index];
      chosenMatches.push(match);
      index = match.end + 1;
    } else {
      index++;
    }
  }
  let bestWord = "";
  let bestWordScore = 0;
  for (let i = 0; i < chosenMatches.length; i++) {
    if (chosenMatches[i].score > bestWordScore) {
      bestWordScore = chosenMatches[i].score;
      bestWord = chosenMatches[i].word;
    }
  }
  return {
    score: dp[0],
    matches: chosenMatches,
    bestWord: bestWord,
    bestWordScore: bestWordScore
  };
}
module.exports = {
  parseWordList: parseWordList,
  buildWordInfoMap: buildWordInfoMap,
  getMatches: getMatches,
  computeScore: computeScore
};
})(g.module.exports, g.module.require, g.module, g.filename, g.dirname);
}