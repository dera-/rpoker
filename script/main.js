module.exports.main = function main(param) {
    "use strict";
    const roleJudge = require("./roleJudge");
    const game = g.game;
    const rng = param.random ? param.random : game.random;
    const WORD_ASSET_IDS = [
        "cards",
        "normalWords",
        "specialWords0",
        "specialWords1",
        "specialWords2",
        "specialWords3",
        "specialWords4"
    ];

    const font = new g.DynamicFont({
        game: game,
        fontFamily: "sans-serif",
        size: 32
    });
    const bigFont = new g.DynamicFont({
        game: game,
        fontFamily: "sans-serif",
        size: 48
    });

    const HAND_SIZE = 7;
    const TOTAL_ROUNDS = 5;

    function loadWordData(assetSource) {
        const words = roleJudge.parseWordList(assetSource.cards.data);
        const normalWords = roleJudge.parseWordList(assetSource.normalWords.data);
        const specialWords0 = roleJudge.parseWordList(assetSource.specialWords0.data);
        const specialWords1 = roleJudge.parseWordList(assetSource.specialWords1.data);
        const specialWords2 = roleJudge.parseWordList(assetSource.specialWords2.data);
        const specialWords3 = roleJudge.parseWordList(assetSource.specialWords3.data);
        const specialWords4 = roleJudge.parseWordList(assetSource.specialWords4.data);

        return {
            words: words,
            wordInfoMap: roleJudge.buildWordInfoMap(words, normalWords, specialWords0, specialWords1, specialWords2, specialWords3, specialWords4, HAND_SIZE)
        };
    }

    function createSimpleButton(targetScene, text, x, y, onClick) {
        const w = 320;
        const h = 60;
        const button = new g.E({
            scene: targetScene,
            x: x,
            y: y,
            width: w,
            height: h,
            touchable: true
        });
        const rect = new g.FilledRect({
            scene: targetScene,
            width: w,
            height: h,
            cssColor: "#3d7cff",
            opacity: 0.9
        });
        const label = new g.Label({
            scene: targetScene,
            font: font,
            fontSize: font.size,
            text: text,
            textColor: "#ffffff",
            x: 12,
            y: (h - font.size) / 2
        });
        button.append(rect);
        button.append(label);
        button.onPointDown.add(() => {
            onClick();
        });
        button.show();
        return button;
    }

    function createGameScene() {
        const scene = new g.Scene({
            game: game,
            assetIds: WORD_ASSET_IDS
        });

        // ランキングスコア
        game.vars.gameState = { score: 0 };

        const cardWidth = 160;
        const cardHeight = 220;
        const cardGap = 20;
        const handY = 220;

        let round = 1;
        let totalScore = 0;
        const roundScores = [];
        let phase = "discard";
        let deck = [];
        let words = [];
        let wordInfoMap = {};
        let hand = [];
        let cardEntities = [];
        let draggingCard = null;
        let draggingStartX = 0;
        let draggingStartY = 0;
        let bestRoundScore = -1;
        let bestRoundHand = "";
        let bestRoundRoles = "なし";

        const uiLayer = new g.E({ scene: scene });
        scene.append(uiLayer);

        const roundLabel = new g.Label({
            scene: scene,
            font: font,
            fontSize: font.size,
            text: "ROUND: 1/" + TOTAL_ROUNDS,
            x: 20,
            y: 20,
            textColor: "#333333"
        });
        uiLayer.append(roundLabel);

        const scoreLabel = new g.Label({
            scene: scene,
            font: font,
            fontSize: font.size,
            text: "TOTAL: 0",
            x: 20,
            y: 60,
            textColor: "#333333"
        });
        uiLayer.append(scoreLabel);

        const phaseLabel = new g.Label({
            scene: scene,
            font: font,
            fontSize: font.size,
            text: "捨てフェイズ",
            x: 20,
            y: 100,
            textColor: "#333333"
        });
        uiLayer.append(phaseLabel);

        const wordLabel = new g.Label({
            scene: scene,
            font: font,
            fontSize: font.size,
            text: "並び: ",
            x: 20,
            y: 520,
            textColor: "#333333"
        });
        uiLayer.append(wordLabel);

        const roleLabel = new g.Label({
            scene: scene,
            font: font,
            fontSize: font.size,
            text: "役: なし",
            x: 20,
            y: 560,
            textColor: "#333333"
        });
        uiLayer.append(roleLabel);

        const previewLabel = new g.Label({
            scene: scene,
            font: font,
            fontSize: font.size,
            text: "評価: 0",
            x: 980,
            y: 520,
            textColor: "#333333"
        });
        uiLayer.append(previewLabel);

        const infoLabel = new g.Label({
            scene: scene,
            font: font,
            fontSize: font.size / 1.2,
            text: "捨てたいカードをタップしてください",
            x: 20,
            y: 610,
            textColor: "#555555"
        });
        uiLayer.append(infoLabel);

        const controlLayer = new g.E({ scene: scene });
        scene.append(controlLayer);

        function createButton(text, x, y, w, h, onClick) {
            const button = new g.E({
                scene: scene,
                x: x,
                y: y,
                width: w,
                height: h,
                touchable: true
            });
            const rect = new g.FilledRect({
                scene: scene,
                width: w,
                height: h,
                cssColor: "#3d7cff",
                opacity: 0.9
            });
            const label = new g.Label({
                scene: scene,
                font: font,
                fontSize: font.size,
                text: text,
                textColor: "#ffffff",
                x: 10,
                y: (h - font.size) / 2
            });
            button.append(rect);
            button.append(label);
            button.onPointDown.add(() => {
                onClick();
            });
            button.show();
            return { button: button, label: label, rect: rect };
        }

        const actionButton = createButton("捨て確定", 980, 580, 260, 70, () => {
            if (phase === "discard") {
                confirmDiscard();
            } else if (phase === "sort") {
                confirmSort();
            }
        });
        controlLayer.append(actionButton.button);

        function buildDeck() {
            deck = [];
            for (let i = 0; i < words.length; i++) {
                for (let j = 0; j < 3; j++) {
                    deck.push(words[i]);
                }
            }
        }

        function drawCard() {
            if (deck.length === 0) buildDeck();
            const index = rng.get(0, deck.length - 1);
            const word = deck[index];
            deck.splice(index, 1);
            return word;
        }

        function clearCards() {
            for (let i = 0; i < cardEntities.length; i++) {
                cardEntities[i].destroy();
            }
            cardEntities = [];
        }

        function createCards() {
            clearCards();
            const totalWidth = cardWidth * hand.length + cardGap * (hand.length - 1);
            const baseX = (game.width - totalWidth) / 2;
            for (let i = 0; i < hand.length; i++) {
                const word = hand[i];
                const card = new g.E({
                    scene: scene,
                    x: baseX + i * (cardWidth + cardGap),
                    y: handY,
                    width: cardWidth,
                    height: cardHeight,
                    touchable: true
                });
                const rect = new g.FilledRect({
                    scene: scene,
                    width: cardWidth,
                    height: cardHeight,
                    cssColor: "#ffffff",
                    opacity: 1.0
                });
                const frame = new g.FilledRect({
                    scene: scene,
                    width: cardWidth,
                    height: cardHeight,
                    cssColor: "#444444",
                    opacity: 0.15
                });
                const label = new g.Label({
                    scene: scene,
                    font: bigFont,
                    fontSize: bigFont.size,
                    text: word,
                    textColor: "#333333",
                    x: 12,
                    y: 80
                });
                card.append(rect);
                card.append(frame);
                card.append(label);

                card.data = {
                    word: word,
                    rect: rect,
                    label: label,
                    selected: false
                };

                card.onPointDown.add(() => {
                    if (phase === "discard") {
                        card.data.selected = !card.data.selected;
                        card.data.rect.cssColor = card.data.selected ? "#ffe48b" : "#ffffff";
                        card.data.rect.modified();
                        updateDiscardInfo();
                    } else if (phase === "sort") {
                        draggingCard = card;
                        draggingStartX = card.x;
                        draggingStartY = card.y;
                    }
                });

                card.onPointMove.add((ev) => {
                    if (phase !== "sort" || draggingCard !== card) return;
                    card.x = draggingStartX + ev.startDelta.x;
                    card.y = draggingStartY + ev.startDelta.y;
                    card.modified();
                });

                card.onPointUp.add(() => {
                    if (phase !== "sort" || draggingCard !== card) return;
                    draggingCard = null;
                    reorderCards(card);
                });

                scene.append(card);
                cardEntities.push(card);
            }
            updatePreview();
        }

        function reorderCards(card) {
            const totalWidth = cardWidth * cardEntities.length + cardGap * (cardEntities.length - 1);
            const baseX = (game.width - totalWidth) / 2;
            const slot = Math.round((card.x - baseX) / (cardWidth + cardGap));
            const targetIndex = Math.max(0, Math.min(cardEntities.length - 1, slot));
            const currentIndex = cardEntities.indexOf(card);
            if (currentIndex >= 0) {
                cardEntities.splice(currentIndex, 1);
                cardEntities.splice(targetIndex, 0, card);
            }
            layoutCards();
            hand = cardEntities.map(c => c.data.word);
            updatePreview();
        }

        function layoutCards() {
            const totalWidth = cardWidth * cardEntities.length + cardGap * (cardEntities.length - 1);
            const baseX = (game.width - totalWidth) / 2;
            for (let i = 0; i < cardEntities.length; i++) {
                const card = cardEntities[i];
                card.x = baseX + i * (cardWidth + cardGap);
                card.y = handY;
                card.modified();
            }
        }

        function updateDiscardInfo() {
            let count = 0;
            for (let i = 0; i < cardEntities.length; i++) {
                if (cardEntities[i].data.selected) count++;
            }
            infoLabel.text = "捨て枚数: " + count + " 枚";
            infoLabel.invalidate();
        }

        function updatePreview() {
            const result = roleJudge.computeScore(hand, wordInfoMap);
            previewLabel.text = "評価: " + result.score;
            previewLabel.invalidate();
            wordLabel.text = "並び: " + hand.join("");
            wordLabel.invalidate();
            const roleText = result.matches.length > 0 ? result.matches.map(m => m.word).join(" / ") : "なし";
            roleLabel.text = "役: " + roleText;
            roleLabel.invalidate();
        }

        function startRound() {
            phase = "discard";
            phaseLabel.text = "捨てフェイズ";
            phaseLabel.invalidate();
            infoLabel.text = "捨てたいカードをタップしてください";
            infoLabel.invalidate();
            actionButton.label.text = "捨て確定";
            actionButton.label.invalidate();

            buildDeck();
            hand = [];
            for (let i = 0; i < HAND_SIZE; i++) {
                hand.push(drawCard());
            }
            createCards();
            updateDiscardInfo();
        }

        function confirmDiscard() {
            const newHand = [];
            let discardCount = 0;
            for (let i = 0; i < cardEntities.length; i++) {
                if (cardEntities[i].data.selected) {
                    discardCount++;
                } else {
                    newHand.push(cardEntities[i].data.word);
                }
            }
            for (let i = 0; i < discardCount; i++) {
                newHand.push(drawCard());
            }
            hand = newHand;
            phase = "sort";
            phaseLabel.text = "ソートフェイズ";
            phaseLabel.invalidate();
            infoLabel.text = "ドラッグして並べ替え、確定してください";
            infoLabel.invalidate();
            actionButton.label.text = "確定";
            actionButton.label.invalidate();
            createCards();
        }

        function confirmSort() {
            const result = roleJudge.computeScore(hand, wordInfoMap);
            totalScore += result.score;
            roundScores.push(result.score);
            scoreLabel.text = "TOTAL: " + totalScore;
            scoreLabel.invalidate();
            if (result.score > bestRoundScore) {
                bestRoundScore = result.score;
                bestRoundHand = hand.join("");
                bestRoundRoles = result.matches.length > 0 ? result.matches.map(m => m.word).join(" / ") : "なし";
            }
            round++;
            if (round > TOTAL_ROUNDS) {
                endGame();
                return;
            }
            roundLabel.text = "ROUND: " + round + "/" + TOTAL_ROUNDS;
            roundLabel.invalidate();
            startRound();
        }

        function endGame() {
            game.vars.gameState.score = totalScore;
            const resultScene = new g.Scene({ game: game });
            resultScene.onLoad.add(() => {
                const title = new g.Label({
                    scene: resultScene,
                    font: bigFont,
                    fontSize: bigFont.size,
                    text: "結果",
                    x: 20,
                    y: 20,
                    textColor: "#333333"
                });
                resultScene.append(title);

                const totalLabel = new g.Label({
                    scene: resultScene,
                    font: bigFont,
                    fontSize: bigFont.size,
                    text: "合計スコア: " + totalScore,
                    x: 20,
                    y: 100,
                    textColor: "#333333"
                });
                resultScene.append(totalLabel);

                const bestRoundScoreLabel = new g.Label({
                    scene: resultScene,
                    font: font,
                    fontSize: font.size,
                    text: "最高ラウンド評価: " + bestRoundScore,
                    x: 20,
                    y: 170,
                    textColor: "#333333"
                });
                resultScene.append(bestRoundScoreLabel);

                const bestHandLabel = new g.Label({
                    scene: resultScene,
                    font: font,
                    fontSize: font.size,
                    text: "並び: " + bestRoundHand,
                    x: 20,
                    y: 210,
                    textColor: "#333333"
                });
                resultScene.append(bestHandLabel);

                const bestRolesLabel = new g.Label({
                    scene: resultScene,
                    font: font,
                    fontSize: font.size,
                    text: "役: " + bestRoundRoles,
                    x: 20,
                    y: 250,
                    textColor: "#333333"
                });
                resultScene.append(bestRolesLabel);

                for (let i = 0; i < roundScores.length; i++) {
                    const line = new g.Label({
                        scene: resultScene,
                        font: font,
                        fontSize: font.size,
                        text: "R" + (i + 1) + ": " + roundScores[i],
                        x: 20,
                        y: 310 + i * 40,
                        textColor: "#555555"
                    });
                    resultScene.append(line);
                }

                const noticeLabel = new g.Label({
                    scene: resultScene,
                    font: font,
                    fontSize: font.size,
                    text: "",
                    x: 20,
                    y: 560,
                    textColor: "#2b7cff"
                });
                resultScene.append(noticeLabel);

                // const rankButton = createSimpleButton(resultScene, "ランキングに登録", 20, 520, () => {
                //     game.vars.gameState.score = totalScore;
                //     noticeLabel.text = "ランキング登録準備OK";
                //     noticeLabel.invalidate();
                // });
                // resultScene.append(rankButton);

                const retryButton = createSimpleButton(resultScene, "もう一度", 20, 620, () => {
                    game.replaceScene(createTitleScene());
                });
                resultScene.append(retryButton);
            });
            game.replaceScene(resultScene);
        }

        scene.onLoad.add(() => {
            const loadedWordData = loadWordData({
                cards: scene.assets.cards,
                normalWords: scene.assets.normalWords,
                specialWords0: scene.assets.specialWords0,
                specialWords1: scene.assets.specialWords1,
                specialWords2: scene.assets.specialWords2,
                specialWords3: scene.assets.specialWords3,
                specialWords4: scene.assets.specialWords4
            });
            words = loadedWordData.words;
            wordInfoMap = loadedWordData.wordInfoMap;
            startRound();
            roundLabel.text = "ROUND: 1/" + TOTAL_ROUNDS;
            roundLabel.invalidate();
            scoreLabel.text = "TOTAL: 0";
            scoreLabel.invalidate();
        });

        return scene;
    }

    function createTitleScene() {
        const titleScene = new g.Scene({ game: game });
        titleScene.onLoad.add(() => {
            const title = new g.Label({
                scene: titleScene,
                font: bigFont,
                fontSize: bigFont.size,
                text: "龍道ポーカー",
                x: 20,
                y: 60,
                textColor: "#333333"
            });
            titleScene.append(title);

            const info1 = new g.Label({
                scene: titleScene,
                font: font,
                fontSize: font.size,
                text: "ルール: 7枚から不要カードを捨てて引き直し、並べ替えて単語を作る",
                x: 20,
                y: 140,
                textColor: "#555555"
            });
            titleScene.append(info1);

            const info2 = new g.Label({
                scene: titleScene,
                font: font,
                fontSize: font.size,
                text: "並び順で単語が完成した時のみ得点。1枚のカードは1単語にのみ使用",
                x: 20,
                y: 180,
                textColor: "#555555"
            });
            titleScene.append(info2);

            const info3 = new g.Label({
                scene: titleScene,
                font: font,
                fontSize: font.size,
                text: "得点は単語に使ったカード数で10^n点（特別役は10^(n+1)）",
                x: 20,
                y: 220,
                textColor: "#555555"
            });
            titleScene.append(info3);

            const startButton = createSimpleButton(titleScene, "スタート", 20, 300, () => {
                game.replaceScene(createGameScene());
            });
            titleScene.append(startButton);
        });
        return titleScene;
    }

    game.pushScene(createTitleScene());
};
