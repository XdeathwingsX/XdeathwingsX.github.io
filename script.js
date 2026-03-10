const app = document.getElementById("app");
const envelopeScreen = document.getElementById("envelope-screen");
const gameScreen = document.getElementById("game-screen");
const envelopeButton = document.getElementById("envelope-button");
const envelopeHint = document.getElementById("envelope-hint");
const bgMusic = document.getElementById("bg-music");

const storyScreen = document.getElementById("story-screen");
const memoryStage = document.getElementById("memory-stage");
const collageStage = document.getElementById("collage-stage");
const transitionStage = document.getElementById("transition-stage");
const collageGrid = document.getElementById("collage-grid");
const memoryLine = document.getElementById("memory-line");

const questionCard = document.getElementById("question-card");
const celebrateCard = document.getElementById("celebrate-card");
const yesBtn = document.getElementById("yes-btn");
const noBtn = document.getElementById("no-btn");
const hint = document.getElementById("hint");
const noFinalMessage = document.getElementById("no-final-message");
const wrap = document.getElementById("buttons-wrap");

const hints = [
  "Try pressing \"No\". It gets shy.",
  "Nope... still floating away.",
  "The universe ships this relationship.",
  "You know which button wants to be tapped.",
  "At this point, even No says Yes."
];

const noLabelSequence = [
  "No",
  "Are you sure?",
  "Sherikm?",
  "Onnudi Chinthiche?",
  "Onnudi ninte thala onnu upayogiche?",
  "onnu podi penne 😉"
];

let dodgeCount = 0;
let yesScale = 1;
let noScale = 1;
let noMoving = false;
let noDisabled = false;
let envelopeOpened = false;
let noLabelIndex = 0;
let clickSuppressUntil = 0;
let musicStarted = false;
let musicFadeFrame = null;
let celebrateStarted = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPhoneLayout() {
  return window.matchMedia("(max-width: 430px)").matches;
}

function rectanglesOverlap(a, b, gap = 0) {
  return !(
    a.right + gap < b.left ||
    a.left - gap > b.right ||
    a.bottom + gap < b.top ||
    a.top - gap > b.bottom
  );
}

function updateHint() {
  const index = clamp(Math.floor(dodgeCount / 3), 0, hints.length - 1);
  hint.style.opacity = "0.5";

  setTimeout(() => {
    hint.textContent = hints[index];
    hint.style.opacity = "1";
  }, 100);
}

function growYesButton() {
  const growthStep = isPhoneLayout() ? 0.13 : 0.1;
  yesScale = Math.min(yesScale + growthStep, 2.45);
  yesBtn.style.setProperty("--yes-scale", String(yesScale));

  yesBtn.classList.remove("yes-pop");
  requestAnimationFrame(() => yesBtn.classList.add("yes-pop"));
}

function fadeMusicTo(targetVolume, durationMs) {
  if (!bgMusic) {
    return;
  }

  if (musicFadeFrame) {
    cancelAnimationFrame(musicFadeFrame);
  }

  const startVolume = bgMusic.volume;
  const start = performance.now();

  function step(now) {
    const progress = clamp((now - start) / durationMs, 0, 1);
    bgMusic.volume = startVolume + (targetVolume - startVolume) * progress;

    if (progress < 1) {
      musicFadeFrame = requestAnimationFrame(step);
    } else {
      musicFadeFrame = null;
    }
  }

  musicFadeFrame = requestAnimationFrame(step);
}

function trySeekMusicToTenSeconds() {
  if (!bgMusic) {
    return;
  }

  const target = 26;

  try {
    if (Number.isFinite(bgMusic.duration) && bgMusic.duration > target) {
      bgMusic.currentTime = target;
    } else if (!Number.isFinite(bgMusic.duration)) {
      bgMusic.currentTime = target;
    }
  } catch (_) {
    // Ignore seek race conditions while metadata loads.
  }
}

function startBackgroundMusic() {
  if (!bgMusic || musicStarted) {
    return;
  }

  musicStarted = true;
  bgMusic.loop = true;
  bgMusic.volume = 0;

  trySeekMusicToTenSeconds();

  if (bgMusic.readyState < 1) {
    bgMusic.addEventListener("loadedmetadata", trySeekMusicToTenSeconds, { once: true });
  }

  const playPromise = bgMusic.play();

  if (playPromise && typeof playPromise.then === "function") {
    playPromise.then(() => {
      trySeekMusicToTenSeconds();
      fadeMusicTo(0.2, 3000);
    }).catch(() => {
      musicStarted = false;
    });
  } else {
    fadeMusicTo(0.2, 3000);
  }
}

function setNoOffset(x, y) {
  noBtn.style.setProperty("--no-x", `${x}px`);
  noBtn.style.setProperty("--no-y", `${y}px`);
}

function setNoScale(scale) {
  noBtn.style.setProperty("--no-scale", String(scale));
}

function resetNoButtonPosition() {
  dodgeCount = 0;
  noScale = 1;
  noMoving = false;
  noDisabled = false;
  noLabelIndex = 0;

  noBtn.textContent = noLabelSequence[0];
  noBtn.style.opacity = "1";
  noBtn.style.pointerEvents = "auto";
  noBtn.classList.remove("hidden");

  noFinalMessage.classList.add("hidden");
  hint.classList.remove("hidden");

  setNoOffset(0, 0);
  setNoScale(noScale);
}

function advanceNoLabel() {
  noLabelIndex = Math.min(noLabelIndex + 1, noLabelSequence.length - 1);
  noBtn.textContent = noLabelSequence[noLabelIndex];
}

function shrinkNoButton() {
  noScale = Math.max(noScale - 0.08, 0.55);
  setNoScale(noScale);
}

function finalizeNoButton() {
  noDisabled = true;
  noBtn.style.opacity = "0";
  noBtn.style.pointerEvents = "none";
  hint.classList.add("hidden");
  noFinalMessage.classList.remove("hidden");
}

function findNoTargetOffset() {
  const wrapRect = wrap.getBoundingClientRect();
  const noRect = noBtn.getBoundingClientRect();
  const yesRect = yesBtn.getBoundingClientRect();

  const anchorX = wrapRect.width * 0.5;
  const anchorY = wrapRect.height * 0.72;

  const minOffsetX = -(anchorX - noRect.width / 2);
  const maxOffsetX = wrapRect.width - noRect.width / 2 - anchorX;
  const minOffsetY = -(anchorY - noRect.height / 2);
  const maxOffsetY = wrapRect.height - noRect.height / 2 - anchorY;

  const tries = 80;
  const safeGap = isPhoneLayout() ? 26 : 18;

  let offsetX = 0;
  let offsetY = 0;

  for (let i = 0; i < tries; i += 1) {
    offsetX = minOffsetX + Math.random() * (maxOffsetX - minOffsetX);
    offsetY = minOffsetY + Math.random() * (maxOffsetY - minOffsetY);

    const candidate = {
      left: wrapRect.left + anchorX + offsetX - noRect.width / 2,
      right: wrapRect.left + anchorX + offsetX + noRect.width / 2,
      top: wrapRect.top + anchorY + offsetY - noRect.height / 2,
      bottom: wrapRect.top + anchorY + offsetY + noRect.height / 2
    };

    if (!rectanglesOverlap(candidate, yesRect, safeGap)) {
      break;
    }
  }

  return {
    x: clamp(offsetX, minOffsetX, maxOffsetX),
    y: clamp(offsetY, minOffsetY, maxOffsetY)
  };
}

function moveNoButton(event) {
  if (event) {
    event.preventDefault();
  }

  if (noMoving || noDisabled || gameScreen.classList.contains("hidden")) {
    return;
  }

  noMoving = true;
  dodgeCount += 1;

  growYesButton();
  updateHint();
  advanceNoLabel();
  shrinkNoButton();

  const target = findNoTargetOffset();
  setNoOffset(target.x, target.y);

  setTimeout(() => {
    noMoving = false;

    if (dodgeCount >= 6 && !noDisabled) {
      finalizeNoButton();
    }
  }, 360);
}

async function celebrate() {
  if (celebrateStarted) {
    return;
  }

  celebrateStarted = true;
  yesBtn.style.pointerEvents = "none";
  noBtn.style.pointerEvents = "none";

  await sleep(1500);

  questionCard.classList.add("hidden");
  celebrateCard.classList.remove("hidden");
  celebrateCard.style.opacity = "0";
  celebrateCard.style.transition = "opacity 2200ms ease";
  app.setAttribute("aria-live", "off");

  requestAnimationFrame(() => {
    celebrateCard.style.opacity = "1";
  });

  for (let i = 0; i < 26; i += 1) {
    const heart = document.createElement("span");
    heart.className = "heart-fall";
    heart.textContent = i % 3 === 0 ? "💖" : i % 2 === 0 ? "❤️" : "💘";
    heart.style.left = `${Math.random() * 100}vw`;
    heart.style.fontSize = `${Math.random() * 18 + 16}px`;
    heart.style.opacity = "0.95";
    heart.style.transition = `transform ${2 + Math.random() * 1.6}s cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${2 + Math.random() * 1.2}s ease`;
    document.body.appendChild(heart);

    requestAnimationFrame(() => {
      const drift = (Math.random() - 0.5) * 120;
      heart.style.transform = `translate(${drift}px, ${window.innerHeight + 120}px) rotate(${Math.random() * 260 - 130}deg)`;
      heart.style.opacity = "0";
    });

    setTimeout(() => heart.remove(), 3800);
  }
}

async function tryLoadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadCollageSources(maxImages = 6) {
  const sources = [];
  const exts = ["jpeg", "jpg", "png", "webp"];

  for (let i = 0; i <= 20; i += 1) {
    for (const ext of exts) {
      const src = `photos/${i}.${ext}`;
      const loaded = await tryLoadImage(src);

      if (loaded) {
        sources.push(loaded);
        break;
      }
    }

    if (sources.length >= maxImages) {
      break;
    }
  }

  return sources;
}

function showStage(stageEl, fadeMs = 800) {
  [memoryStage, collageStage, transitionStage].forEach((el) => {
    el.classList.add("hidden");
    el.classList.remove("visible");
  });

  stageEl.style.transitionDuration = `${fadeMs}ms`;
  stageEl.classList.remove("hidden");
  requestAnimationFrame(() => {
    stageEl.classList.add("visible");
  });
}

async function runMemoryStage() {
  memoryLine.style.opacity = "0";
  memoryLine.style.transition = "opacity 5000ms ease";

  showStage(memoryStage, 1500);

  // Pure appearance fade-in, stage timing remains JS-driven.
  requestAnimationFrame(() => {
    setTimeout(() => {
      memoryLine.style.opacity = "1";
    }, 40);
  });

  await sleep(10000);
  memoryStage.classList.remove("visible");
  await sleep(900);
}

async function runCollageStage() {
  showStage(collageStage);
  collageGrid.innerHTML = "";

  let sources = await loadCollageSources(6);

  if (sources.length < 4) {
    sources = ["Photos/0.jpeg", "Photos/1.jpeg", "Photos/2.jpeg", "Photos/4.jpeg", "Photos/5.jpeg", "Photos/6.jpeg"];
  }

  const used = sources.slice(0, 6);

  for (const src of used) {
    const img = document.createElement("img");
    img.className = "collage-photo";
    img.src = src;
    img.alt = "Memory photo";
    collageGrid.appendChild(img);

    requestAnimationFrame(() => {
      img.classList.add("show");
    });

    await sleep(700);
  }

  await sleep(4000);
  collageGrid.classList.add("fade-out");
  await sleep(1200);
  collageGrid.classList.remove("fade-out");
}

async function runTransitionStage() {
  showStage(transitionStage);
  await sleep(3000);
  transitionStage.classList.remove("visible");
  await sleep(800);
}

async function runStorySequence() {
  storyScreen.classList.remove("hidden");

  await runMemoryStage();
  await runCollageStage();
  await runTransitionStage();

  storyScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  gameScreen.classList.add("screen-fade-in");
  resetNoButtonPosition();
}

async function revealGameFromEnvelope() {
  if (envelopeOpened) {
    return;
  }

  startBackgroundMusic();

  envelopeOpened = true;
  envelopeButton.classList.add("opened");
  envelopeHint.textContent = "Opening your letter...";

  await sleep(700);
  envelopeScreen.style.animationDuration = "1000ms";
  envelopeScreen.classList.add("screen-fade-out");
  await sleep(1000);

  envelopeScreen.style.display = "none";
  await runStorySequence();
}

envelopeButton.addEventListener("click", revealGameFromEnvelope);
envelopeButton.addEventListener("pointerup", revealGameFromEnvelope);
envelopeButton.addEventListener("touchend", revealGameFromEnvelope, { passive: true });

yesBtn.addEventListener("animationend", () => {
  yesBtn.classList.remove("yes-pop");
});

yesBtn.addEventListener("click", celebrate);

// Touch-first handler for iPhone/Safari. Suppress follow-up click to avoid double-moves.
noBtn.addEventListener("pointerdown", (event) => {
  clickSuppressUntil = Date.now() + 420;
  moveNoButton(event);
});

noBtn.addEventListener("touchstart", (event) => {
  clickSuppressUntil = Date.now() + 420;
  moveNoButton(event);
}, { passive: false });

if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  noBtn.addEventListener("mouseenter", moveNoButton);
}

noBtn.addEventListener("click", (event) => {
  if (Date.now() < clickSuppressUntil) {
    event.preventDefault();
    return;
  }

  moveNoButton(event);
});

window.addEventListener("resize", () => {
  if (!gameScreen.classList.contains("hidden")) {
    resetNoButtonPosition();
  }
});


















