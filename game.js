// =======================
// Pazaak Game Logic (Fixed Incremental Refactor)
// =======================

const game = {
  deck: [],
  playerBoard: [],
  dealerBoard: [],
  playerHand: [],
  dealerHand: [],
  playerSideDeck: [],
  dealerSideDeck: [],
  turn: "player",
  standing: { player: false, dealer: false },
  score: { player: 0, dealer: 0 },
  status: "setup",
  phase: "chooseDifficulty",
  dealerDifficulty: null,
  cardPlayedThisTurn: false,
  availableCards: [],
  playerHasTiebreaker: false,
  dealerHasTiebreaker: false
};

// =======================
// Utility
// =======================
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sum(a) { return a.reduce((x, y) => x + y, 0); }
function drawCard() { return game.deck.pop(); }

function resetMainDeck() {
  game.deck = [];
  for (let n = 1; n <= 10; n++) {
    for (let j = 0; j < 4; j++) game.deck.push(n);
  }
  shuffle(game.deck);
}

// =======================
// Initial Screen / Flow Control
// =======================
function startGame() {
  resetMainDeck();
  setupAvailableCards();
  game.status = "setup";
  game.phase = "chooseDifficulty";
  ui.clear();
  ui.log("=== PAZAAK ===");
  ui.log("Choose Dealer Difficulty:");
  ui.log("Options: veryeasy | easy | average | hard | veryhard | random");
  ui.log("Type your choice below...");
}

function handleCommand(action, value) {
  if (game.phase === "chooseDifficulty") {
    handleDifficultySelection(action);
    return;
  }

  if (action === "reset") {
    startGame();
  }
}

function handleDifficultySelection(input) {
  const difficulty = input.trim().toLowerCase();
  const valid = ["veryeasy", "easy", "average", "hard", "veryhard", "random"];

  if (!valid.includes(difficulty)) {
    ui.log("Invalid choice. Options: veryeasy | easy | average | hard | veryhard | random");
    return;
  }

  game.dealerDifficulty = difficulty;
  if (difficulty === "random") {
    ui.log("Dealer difficulty set to: RANDOM");
    game.dealerSideDeck = createRandomDealerDeck();
  } else {
    try {
      game.dealerSideDeck = getDealerDeck(difficulty);
      ui.log(`Dealer difficulty set to: ${difficulty.toUpperCase()}`);
    } catch (err) {
      ui.log("Could not load dealer deck. Falling back to random.");
      console.error(err);
      game.dealerSideDeck = createRandomDealerDeck();
    }
  }

  if (!Array.isArray(game.dealerSideDeck) || game.dealerSideDeck.length === 0) {
    ui.log("Dealer deck missing or empty — generating random fallback.");
    game.dealerSideDeck = createRandomDealerDeck();
  }

  ui.log(`Dealer Deck: [${game.dealerSideDeck.join(", ")}]`);
  ui.log("\nNow build your side deck (10 cards).");
  ui.log("Commands: add X | sub X | confirm | clear | list");

  startDeckBuilder();
  game.phase = "deckBuilding";
}

// =======================
// Deck Setup
// =======================
function setupAvailableCards() {
  game.availableCards = [];

  for (let n = 1; n <= 6; n++) {
    game.availableCards.push(n, n, -n, -n);
  }

  for (let n = 1; n <= 6; n++) {
    game.availableCards.push(`[+/-]${n}`, `[+/-]${n}`);
  }

  game.availableCards.push(`[+/-][1/2]`);
  game.availableCards.push(`[flip 2&4]`, `[flip 2&4]`);
  game.availableCards.push(`[flip 3&6]`, `[flip 3&6]`);
  game.availableCards.push(`[double]`);
  game.availableCards.push(`[tiebreaker]`);
}

// =======================
// Deck Builder
// =======================
function startDeckBuilder() {
  game.status = "setup";
  setupAvailableCards();

  const saved = localStorage.getItem("pazaak_player_deck");

  if (saved) {
    game.playerSideDeck = JSON.parse(saved);

    for (const val of game.playerSideDeck) {
      const idx = game.availableCards.indexOf(val);
      if (idx !== -1) game.availableCards.splice(idx, 1);
    }

    ui.log(`Loaded saved deck: [${game.playerSideDeck.map(v => v > 0 ? "+" + v : v).join(", ")}]`);
    ui.log("Type 'confirm' to use this deck, or 'clear' to rebuild.");
  } else {
    game.playerSideDeck = [];
    ui.log("=== BUILD YOUR SIDE DECK (10 cards) ===");
    ui.log("Use 'add X' to add +X, 'sub X' to remove a card.");
    ui.log("Cards available: +1–+6, -1–-6 (2 copies each).");
  }

  ui.console.textContent = "";
  ui.drawDeckBuilder();
}

function confirmDeck() {
  if (game.playerSideDeck.length !== 10)
    return ui.log(`Deck must have 10 cards. Currently ${game.playerSideDeck.length}.`);
  localStorage.setItem("pazaak_player_deck", JSON.stringify(game.playerSideDeck));
  ui.log(`Deck confirmed: [${game.playerSideDeck.join(", ")}]`);
  startMatch();
}

function clearDeck() {
  localStorage.removeItem("pazaak_player_deck");
  game.playerSideDeck = [];
  setupAvailableCards();
  ui.log("Deck cleared. Start building again.");
  ui.drawDeckBuilder();
}

// =======================
// Game Flow
// =======================
function createRandomDealerDeck() {
  const dealerPool = [];
  for (let n = 1; n <= 6; n++) dealerPool.push(n, n, -n, -n);
  shuffle(dealerPool);

  dealerPool.push(`[+/-]1`, `[+/-]2`, `[flip 2&4]`, `[flip 3&6]`, `[double]`, `[tiebreaker]`);
  shuffle(dealerPool);
  return dealerPool.slice(0, 10);
}

function startMatch() {
  game.score = { player: 0, dealer: 0 };
  game.dealerSideDeck = createRandomDealerDeck();
  game.playerHand = drawSideHand(game.playerSideDeck);
  game.dealerHand = drawSideHand(game.dealerSideDeck);
  resetMainDeck();
  game.status = "playing";
  game.phase = "playing";
  ui.log("\n=== New Pazaak Match Started ===");
  startRound();
}

function drawSideHand(deck) {
  shuffle(deck);
  return deck.slice(0, 4);
}

function startRound() {
  if (game.deck.length < 10) resetMainDeck();
  game.playerBoard = [];
  game.dealerBoard = [];
  game.standing = { player: false, dealer: false };
  game.turn = "player";
  game.status = "playing";
  game.cardPlayedThisTurn = false;
  game.playerHasTiebreaker = false;
  game.dealerHasTiebreaker = false;

  ui.log(`\n=== New Round === (Score: P ${game.score.player} - D ${game.score.dealer})`);
  forceDraw();
}

// =======================
// Helpers
// =======================
function flipCards(targets, board) {
  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (targets.includes(v)) board[i] = -v;
  }
}

function removeCardFromHand(hand, value) {
  const idx = hand.indexOf(value);
  if (idx !== -1) hand.splice(idx, 1);
}

// =======================
// Turn Flow
// =======================
function forceDraw() {
  const board = game.turn === "player" ? game.playerBoard : game.dealerBoard;
  const card = drawCard();
  board.push(card);
  ui.log(`${game.turn.toUpperCase()} draws ${card}`);
  const total = sum(board);
  if (total === 20) {
    game.standing[game.turn] = true;
    ui.log(`${game.turn.toUpperCase()} hits 20 and stands.`);
    endRoundIfNeeded();
  } else ui.drawScreen();
}

function switchTurn() {
  game.cardPlayedThisTurn = false;
  game.turn = game.turn === "player" ? "dealer" : "player";

  if (game.standing[game.turn]) {
    endRoundIfNeeded();
    return;
  }

  forceDraw();

  const total = sum(game.turn === "player" ? game.playerBoard : game.dealerBoard);
  ui.log(`\n=== ${game.turn.toUpperCase()} Turn (${total}) ===`);

  if (game.turn === "dealer") {
    setTimeout(dealerTakeTurn, 800);
  }
}

function endRoundIfNeeded() {
  if (game.standing.player && game.standing.dealer) evaluateRound();
  else switchTurn();
}

function checkForStandAfterPlay(board) {
  const total = sum(board);
  if (total === 20) {
    const who = game.turn;
    game.standing[who] = true;
    ui.log(`${who.toUpperCase()} hits 20 and stands.`);
    endRoundIfNeeded();
    return true;
  }
  return false;
}

// =======================
// Play a Card
// =======================
function playCard(value) {
  if (game.cardPlayedThisTurn)
    return ui.log(`${game.turn} already played a side card this turn.`);

  const hand = game.turn === "player" ? game.playerHand : game.dealerHand;
  const board = game.turn === "player" ? game.playerBoard : game.dealerBoard;
  const cmd = value?.trim();

  // Flip
  if (cmd.startsWith("[flip")) {
    const flipType = cmd.includes("2&4") ? [2, 4] : [3, 6];
    for (let i = 0; i < board.length; i++) {
      const val = board[i];
      if (val > 0 && flipType.includes(val)) board[i] = -val;
    }

    removeCardFromHand(hand, cmd);
    ui.log(`${game.turn.toUpperCase()} played ${cmd} — flipped ${flipType.map(n => n).join(" & ")} on their own board.`);
    game.cardPlayedThisTurn = true;
    if (checkForStandAfterPlay(board)) return;
    ui.drawScreen();
    return;
  }

  // Double
  if (cmd === "[double]") {
    const lastCard = board[board.length - 1];
    board[board.length - 1] = lastCard * 2;
    removeCardFromHand(hand, "[double]");
    ui.log(`${game.turn} played [double] — last card doubled to ${lastCard * 2}.`);
    game.cardPlayedThisTurn = true;
    if (checkForStandAfterPlay(board)) return;
    ui.drawScreen();
    return;
  }

  // Tiebreaker
  if (cmd === "[tiebreaker]") {
    board.push(1);
    removeCardFromHand(hand, "[tiebreaker]");
    if (game.turn === "player") game.playerHasTiebreaker = true;
    else game.dealerHasTiebreaker = true;
    ui.log(`${game.turn} played [tiebreaker ±1].`);
    game.cardPlayedThisTurn = true;
    if (checkForStandAfterPlay(board)) return;
    ui.drawScreen();
    return;
  }

  // [+/-][1/2]
  if (cmd.startsWith("[+]") && cmd.includes("][1]")) {
    board.push(1);
    removeCardFromHand(hand, "[+/-][1/2]");
  } else if (cmd.startsWith("[-]") && cmd.includes("][1]")) {
    board.push(-1);
    removeCardFromHand(hand, "[+/-][1/2]");
  } else if (cmd.startsWith("[+]") && cmd.includes("][2]")) {
    board.push(2);
    removeCardFromHand(hand, "[+/-][1/2]");
  } else if (cmd.startsWith("[-]") && cmd.includes("][2]")) {
    board.push(-2);
    removeCardFromHand(hand, "[+/-][1/2]");
  }

  // Normal [+/-]X cards
  const match = cmd.match(/^\[\+|\-\](\d+)$/);
  if (match) {
    const sign = cmd.includes("[+]") ? 1 : -1;
    const n = parseInt(cmd.replace(/\D/g, ""));
    const cardStr = `[+/-]${n}`;
    const idx = hand.indexOf(cardStr);
    if (idx === -1) return ui.log(`${game.turn} does not have ${cardStr} in hand.`);
    hand.splice(idx, 1);
    board.push(sign * n);
    ui.log(`${game.turn} played ${cmd} → ${sign > 0 ? "+" : ""}${n}`);
    game.cardPlayedThisTurn = true;
    if (checkForStandAfterPlay(board)) return;
    ui.drawScreen();
    return;
  }

  // Normal numeric cards
  const n = parseInt(value);
  const idx = hand.indexOf(n);
  if (idx === -1) return ui.log(`${game.turn} does not have that card.`);
  hand.splice(idx, 1);
  board.push(n);

  game.cardPlayedThisTurn = true;
  const total = sum(board);
  ui.log(`${game.turn} total: ${total}`);

  if (total === 20) {
    game.standing[game.turn] = true;
    ui.log(`${game.turn.toUpperCase()} hits 20 and stands.`);
    endRoundIfNeeded();
  } else ui.drawScreen();
}

// =======================
// Evaluate Round
// =======================
function evaluateRound() {
  const p = sum(game.playerBoard), d = sum(game.dealerBoard);
  const pBust = p > 20, dBust = d > 20;
  const pCards = game.playerBoard.length;
  const dCards = game.dealerBoard.length;
  let result = "";

  // 9-card auto-win
  if (!pBust && pCards >= 9 && (!dBust || dCards < 9)) {
    ui.log("[Special] Player reached 9 cards without busting!");
    result = "Player wins by filling all 9 cards without busting!";
    game.score.player++;
  } else if (!dBust && dCards >= 9 && (!pBust || pCards < 9)) {
    ui.log("[Special] Dealer reached 9 cards without busting!");
    result = "Dealer wins by filling all 9 cards without busting!";
    game.score.dealer++;
  }

  // Standard scoring
  else if (pBust && dBust) result = "Both bust — tie.";
  else if (pBust) { result = "Dealer wins (player bust)."; game.score.dealer++; }
  else if (dBust) { result = "Player wins (dealer bust)."; game.score.player++; }
  else if (p === d) {
    if (game.playerHasTiebreaker && !game.dealerHasTiebreaker) {
      result = "Player wins via tiebreaker card!";
      game.score.player++;
    } else if (game.dealerHasTiebreaker && !game.playerHasTiebreaker) {
      result = "Dealer wins via tiebreaker card!";
      game.score.dealer++;
    } else result = "Tie game.";
  } else if (p > d) { result = "Player wins."; game.score.player++; }
  else { result = "Dealer wins."; game.score.dealer++; }

  ui.log(`ROUND RESULT: ${result}`);
  ui.log(`Score -> P:${game.score.player} D:${game.score.dealer}`);
  ui.drawScreen();

  // Match end
  if (game.score.player >= 3 || game.score.dealer >= 3) {
    const winner = game.score.player > game.score.dealer ? "PLAYER" : "DEALER";
    ui.log(`MATCH OVER: ${winner} WINS`);
    ui.mainAdd(`\n=== MATCH OVER ===\n${winner} WINS THE MATCH!\n`);
    game.status = "match over";
    ui.drawScreen();
  } else {
    game.status = "round over";
    setTimeout(startRound, 1500);
  }
}

// =======================
// Turn Control
// =======================
function stand() {
  game.standing[game.turn] = true;
  ui.log(`${game.turn.toUpperCase()} stands at ${sum(game.turn === "player" ? game.playerBoard : game.dealerBoard)}.`);
  endRoundIfNeeded();
}

function endTurn() {
  const board = game.turn === "player" ? game.playerBoard : game.dealerBoard;
  const total = sum(board);
  ui.log(`${game.turn} ends turn at ${total}.`);
  if (total > 20) {
    game.standing[game.turn] = true;
    if (game.turn === "player") game.standing.dealer = true;
    else game.standing.player = true;
    evaluateRound();
  } else switchTurn();
}
