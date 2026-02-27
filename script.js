const data = window.N0VA_DATA || { games: [], sounds: [] };

const boot = document.getElementById("boot");
const bootBar = document.getElementById("bootBar");
const bootPct = document.getElementById("bootPct");
const app = document.getElementById("app");

const tabs = document.querySelectorAll(".tab");
const gamesPanel = document.getElementById("gamesPanel");
const soundsPanel = document.getElementById("soundsPanel");

const gameSearch = document.getElementById("gameSearch");
const gameSearchBtn = document.getElementById("gameSearchBtn");
const gameClearBtn = document.getElementById("gameClearBtn");
const gameCount = document.getElementById("gameCount");
const toggleGameListBtn = document.getElementById("toggleGameListBtn");
const gamesLayout = document.getElementById("gamesLayout");
const gameGrid = document.getElementById("gameGrid");
const gameFrame = document.getElementById("gameFrame");
const frameState = document.getElementById("frameState");

const soundSearch = document.getElementById("soundSearch");
const soundSearchBtn = document.getElementById("soundSearchBtn");
const soundClearBtn = document.getElementById("soundClearBtn");
const soundCount = document.getElementById("soundCount");
const soundGrid = document.getElementById("soundGrid");

const state = {
  games: data.games,
  sounds: data.sounds,
  filteredGames: data.games,
  filteredSounds: data.sounds,
  activeGameId: null,
  activeTab: "games",
  gamesListCollapsed: false
};

const soundAudioCache = new Map();
const gameDocCache = new Map();
let gameLoadToken = 0;

function updateBoot(progress) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  bootBar.style.width = `${pct}%`;
  bootPct.textContent = `${pct}%`;
}

function normalize(value) {
  return (value || "").toLowerCase().trim();
}

function setTab(tab) {
  state.activeTab = tab;
  tabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  gamesPanel.classList.toggle("active", tab === "games");
  soundsPanel.classList.toggle("active", tab === "sounds");
}

function setFrameLoading(text = "loading") {
  frameState.textContent = text;
  frameState.classList.remove("hide");
}

function hideFrameLoading() {
  frameState.classList.add("hide");
}

function getBaseFromUrl(url) {
  const index = url.lastIndexOf("/");
  if (index < 0) {
    return url;
  }
  return url.slice(0, index + 1);
}

function injectBaseTag(html, baseHref) {
  if (!html || /<base\s/i.test(html)) {
    return html;
  }

  const headOpen = html.match(/<head[^>]*>/i);
  if (headOpen) {
    const at = headOpen.index + headOpen[0].length;
    return `${html.slice(0, at)}<base href="${baseHref}">${html.slice(at)}`;
  }

  return `<base href="${baseHref}">${html}`;
}

function extractPlayableHtml(text, fileUrl) {
  if (!text) {
    return "";
  }

  const cdataMatch = text.match(/<Content[^>]*><!\[CDATA\[([\s\S]*?)\]\]>\s*<\/Content>/i);
  let html = cdataMatch ? cdataMatch[1] : text;

  if (!/<html[\s>]/i.test(html) && !/<!doctype html/i.test(html)) {
    return "";
  }

  html = injectBaseTag(html, getBaseFromUrl(fileUrl));
  return html;
}

async function getGameDoc(fileUrl) {
  if (!fileUrl) {
    return "";
  }

  if (gameDocCache.has(fileUrl)) {
    return gameDocCache.get(fileUrl);
  }

  try {
    const res = await fetch(fileUrl, { mode: "cors", cache: "force-cache" });
    if (!res.ok) {
      gameDocCache.set(fileUrl, "");
      return "";
    }

    const raw = await res.text();
    const doc = extractPlayableHtml(raw, fileUrl);
    gameDocCache.set(fileUrl, doc);
    return doc;
  } catch {
    gameDocCache.set(fileUrl, "");
    return "";
  }
}

function updateGameCount() {
  gameCount.textContent = `${state.filteredGames.length} / ${state.games.length}`;
}

function updateSoundCount() {
  soundCount.textContent = `${state.filteredSounds.length} / ${state.sounds.length}`;
}

function setGameListCollapsed(collapsed) {
  state.gamesListCollapsed = !!collapsed;
  gamesLayout.classList.toggle("list-collapsed", state.gamesListCollapsed);
  toggleGameListBtn.textContent = state.gamesListCollapsed ? "show list" : "hide list";
}

async function selectGame(gameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) {
    return;
  }

  state.activeGameId = gameId;

  const cards = gameGrid.querySelectorAll(".game-card");
  cards.forEach((card) => {
    card.classList.toggle("active", Number(card.dataset.id) === gameId);
  });

  const token = ++gameLoadToken;
  setFrameLoading("loading");
  window.setTimeout(() => {
    if (token === gameLoadToken && !frameState.classList.contains("hide")) {
      setFrameLoading("blocked");
    }
  }, 7000);

  gameFrame.srcdoc = "";
  gameFrame.src = "about:blank";

  if (game.fileUrl) {
    const doc = await getGameDoc(game.fileUrl);
    if (token !== gameLoadToken) {
      return;
    }
    if (doc) {
      gameFrame.srcdoc = doc;
      return;
    }
  }

  if (token !== gameLoadToken) {
    return;
  }

  if (game.embedUrl) {
    gameFrame.src = game.embedUrl;
    return;
  }

  setFrameLoading("blocked");
}

function renderGames() {
  gameGrid.innerHTML = "";

  const fragment = document.createDocumentFragment();
  for (const game of state.filteredGames) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "game-card";
    card.dataset.id = String(game.id);

    const img = document.createElement("img");
    img.src = game.icon;
    img.alt = game.name;
    img.loading = "lazy";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = game.name;

    card.appendChild(img);
    card.appendChild(name);

    card.addEventListener("click", () => selectGame(game.id));

    if (state.activeGameId === game.id) {
      card.classList.add("active");
    }

    fragment.appendChild(card);
  }

  gameGrid.appendChild(fragment);
  updateGameCount();

  if (state.filteredGames.length === 0) {
    setFrameLoading("no results");
    gameFrame.removeAttribute("src");
    state.activeGameId = null;
    return;
  }

  const stillVisible = state.filteredGames.some((item) => item.id === state.activeGameId);
  if (!stillVisible) {
    selectGame(state.filteredGames[0].id);
  }
}

function filterGames() {
  const q = normalize(gameSearch.value);
  if (!q) {
    state.filteredGames = state.games;
  } else {
    state.filteredGames = state.games.filter((game) => normalize(game.name).includes(q));
  }
  renderGames();
}

function getAudio(url) {
  if (!soundAudioCache.has(url)) {
    const audio = new Audio(url);
    audio.preload = "none";
    soundAudioCache.set(url, audio);
  }
  return soundAudioCache.get(url);
}

function playSound(sound, button) {
  const audio = getAudio(sound.url);
  button.classList.remove("error");
  button.classList.add("active");

  audio.currentTime = 0;
  audio.play().then(
    () => {
      window.setTimeout(() => button.classList.remove("active"), 280);
    },
    () => {
      button.classList.remove("active");
      button.classList.add("error");
      window.setTimeout(() => button.classList.remove("error"), 520);
    }
  );
}

function renderSounds() {
  soundGrid.innerHTML = "";

  const fragment = document.createDocumentFragment();
  for (const sound of state.filteredSounds) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sound-btn";

    const n = document.createElement("span");
    n.className = "n";
    n.textContent = sound.name;

    const t = document.createElement("span");
    t.className = "t";
    t.textContent = `sound ${sound.id}`;

    const disc = document.createElement("span");
    disc.className = "sound-disc";

    const cap = document.createElement("span");
    cap.className = "sound-cap";
    disc.appendChild(cap);

    button.appendChild(disc);
    button.appendChild(n);
    button.appendChild(t);

    button.addEventListener("click", () => playSound(sound, button));
    fragment.appendChild(button);
  }

  soundGrid.appendChild(fragment);
  updateSoundCount();
}

function filterSounds() {
  const q = normalize(soundSearch.value);
  if (!q) {
    state.filteredSounds = state.sounds;
  } else {
    state.filteredSounds = state.sounds.filter((sound) => normalize(sound.name).includes(q));
  }
  renderSounds();
}

function wireSearch(input, searchButton, clearButton, action) {
  searchButton.addEventListener("click", action);
  clearButton.addEventListener("click", () => {
    input.value = "";
    action();
    input.focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      action();
    }
  });
}

function bootApp() {
  let progress = 0;
  let target = 5;

  const timer = window.setInterval(() => {
    progress += (target - progress) * 0.12;
    if (Math.abs(target - progress) < 0.2) {
      progress = target;
    }
    updateBoot(progress);
  }, 28);

  const stage = async () => {
    await new Promise((resolve) => setTimeout(resolve, 220));
    target = 24;

    await new Promise((resolve) => setTimeout(resolve, 260));
    target = 47;
    renderGames();

    await new Promise((resolve) => setTimeout(resolve, 260));
    target = 74;
    renderSounds();

    await new Promise((resolve) => setTimeout(resolve, 280));
    target = 96;

    await new Promise((resolve) => setTimeout(resolve, 220));
    target = 100;

    await new Promise((resolve) => setTimeout(resolve, 220));
    window.clearInterval(timer);
    updateBoot(100);

    boot.classList.add("hide");
    app.classList.remove("hidden");
    window.setTimeout(() => boot.remove(), 420);
  };

  stage();
}

wireSearch(gameSearch, gameSearchBtn, gameClearBtn, filterGames);
wireSearch(soundSearch, soundSearchBtn, soundClearBtn, filterSounds);

toggleGameListBtn.addEventListener("click", () => {
  setGameListCollapsed(!state.gamesListCollapsed);
});

for (const button of tabs) {
  button.addEventListener("click", () => setTab(button.dataset.tab));
}

gameFrame.addEventListener("load", () => {
  hideFrameLoading();
});

setTab("games");
setGameListCollapsed(false);
bootApp();
