"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const roleJudge = require("../script/roleJudge");

const readList = (name) => {
    const fullPath = path.join(__dirname, "..", "text", name);
    return roleJudge.parseWordList(fs.readFileSync(fullPath, "utf8"));
};

const cards = readList("cards.txt");
const normalWords = readList("normal_words.txt");
const specialWords0 = readList("special_words_0.txt");
const specialWords1 = readList("special_words_1.txt");
const specialWords2 = readList("special_words_2.txt");
const specialWords3 = readList("special_words_3.txt");
const specialWords4 = readList("special_words_4.txt");

const wordInfoMap = roleJudge.buildWordInfoMap(
    cards,
    normalWords,
    specialWords0,
    specialWords1,
    specialWords2,
    specialWords3,
    specialWords4,
    7
);

const patternCase = (pattern) => {
    const pick = {
        1: [
            { word: "眼鏡", hand: ["眼鏡"] },
            { word: "剛毛", hand: ["剛", "毛"] },
            { word: "無毛", hand: ["無", "毛"] }
        ],
        2: [
            { word: "姉", hand: ["姉"] },
            { word: "妹", hand: ["妹"] }
        ],
        3: [
            { word: "H", hand: ["H"] },
            { word: "P", hand: ["P"] }
        ],
        4: [
            { word: "会", hand: ["会"] },
            { word: "愛", hand: ["愛"] }
        ]
    };
    const useCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const words = [];
    const hand = [];
    for (let i = 0; i < pattern.length; i++) {
        const cat = pattern[i];
        const idx = useCount[cat];
        useCount[cat] = idx + 1;
        const item = pick[cat][idx];
        words.push(item.word);
        hand.push(...item.hand);
    }
    return { word: words.join(""), hand: hand };
};

test("normal word is scored as 10^n", () => {
    const result = roleJudge.computeScore(["大", "学", "生"], wordInfoMap);
    assert.equal(result.score, 1000);
    assert.equal(result.bestWord, "大学生");
    assert.equal(result.bestWordScore, 1000);
});

test("specialWords0 uses multiplier 2", () => {
    const hand = ["銀", "髪", "褐", "色", "巨", "乳", "ｴﾙﾌ"];
    const result = roleJudge.computeScore(hand, wordInfoMap);
    assert.equal(result.bestWord, "銀髪褐色巨乳ｴﾙﾌ");
    assert.equal(result.bestWordScore, 2 * Math.pow(10, 8));
});

test("specialWords1 can concatenate up to two times", () => {
    const hand = ["巨", "乳", "巨", "尻", "爆", "乳"];
    const result = roleJudge.computeScore(hand, wordInfoMap);
    assert.equal(result.bestWord, "巨乳巨尻爆乳");
    assert.equal(result.bestWordScore, Math.pow(10, 7));
});

test("concatenated specialWords1 can be prefixed to other special words", () => {
    const hand = ["巨", "乳", "爆", "乳", "女", "子"];
    const result = roleJudge.computeScore(hand, wordInfoMap);
    assert.equal(result.bestWord, "巨乳爆乳女子");
    assert.equal(result.bestWordScore, Math.pow(10, 7));
});

test("disjoint words are optimally combined", () => {
    const hand = ["巨", "乳", "女", "子", "大", "学", "生"];
    const result = roleJudge.computeScore(hand, wordInfoMap);
    assert.equal(result.score, Math.pow(10, 5) + Math.pow(10, 3));
    assert.deepEqual(result.matches.map(m => m.word), ["巨乳女子", "大学生"]);
});

test("all base special-word connection patterns are judged as one role", () => {
    const patterns = [
        [1, 1],
        [1, 2],
        [1, 2, 3],
        [1, 2, 3, 4],
        [2, 3],
        [2, 3, 4],
        [3, 4],
        [1, 4],
        [2, 4],
        [1, 3]
    ];

    for (let i = 0; i < patterns.length; i++) {
        const p = patterns[i];
        const c = patternCase(p);
        const result = roleJudge.computeScore(c.hand, wordInfoMap);
        assert.equal(result.bestWord, c.word, "pattern: " + p.join(","));
        assert.equal(result.bestWordScore, Math.pow(10, c.hand.length + 1), "pattern score: " + p.join(","));
    }
});
