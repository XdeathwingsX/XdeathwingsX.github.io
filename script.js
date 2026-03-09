const app = document.getElementById("app");
const envelopeScreen = document.getElementById("envelope-screen");
const gameScreen = document.getElementById("game-screen");
const envelopeButton = document.getElementById("envelope-button");
const envelopeHint = document.getElementById("envelope-hint");

const questionCard = document.getElementById("question-card");
const celebrateCard = document.getElementById("celebrate-card");
const yesBtn = document.getElementById("yes-btn");
const noBtn = document.getElementById("no-btn");
const hint = document.getElementById("hint");
const wrap = document.getElementById("buttons-wrap");

const hints = [
  "Try pressing \"No\". It gets shy.",
  "Nope... still floating away.",
  "The universe ships this relationship.",
  "You know which button wants to be tapped.",
  "At this point, even No says Yes."
];

let dodgeCount = 0;
let yesScale = 1;
let noMoving = false;
let envelopeOpened = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
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

function currentNoPosition() {
  const wrapRect = wrap.getBoundingClientRect();
  const noRect = noBtn.getBoundingClientRect();

  return {
    x: clamp(noRect.left - wrapRect.left, 0, wrapRect.width - noRect.width),
    y: clamp(noRect.top - wrapRect.top, 0, wrapRect.height - noRect.height)
  };
}

function placeNoAt(x, y) {
  noBtn.style.left = `${x}px`;
  noBtn.style.top = `${y}px`;
  noBtn.style.transform = "none";
}

function resetNoButtonPosition() {
  const wrapRect = wrap.getBoundingClientRect();
  const noRect = noBtn.getBoundingClientRect();

  const centeredX = (wrapRect.width - noRect.width) / 2;
  const startY = wrapRect.height * 0.68 - noRect.height / 2;

  placeNoAt(clamp(centeredX, 0, wrapRect.width - noRect.width), clamp(startY, 0, wrapRect.height - noRect.height));
}

function animateNoWave(targetX, targetY) {
  const start = currentNoPosition();
  const amplitude = Math.min(26, Math.max(14, Math.abs(targetX - start.x) * 0.25));
  const direction = targetX >= start.x ? 1 : -1;
  const duration = 560;
  const begin = performance.now();

  function frame(now) {
    const rawT = clamp((now - begin) / duration, 0, 1);
    const t = easeInOutSine(rawT);

    const x = lerp(start.x, targetX, t);
    const waveOffset = Math.sin(rawT * Math.PI * 2) * amplitude * (1 - rawT) * direction;
    const yBase = lerp(start.y, targetY, t);
    const y = yBase + waveOffset;

    placeNoAt(x, y);

    if (rawT < 1) {
      requestAnimationFrame(frame);
      return;
    }

    placeNoAt(targetX, targetY);
    noMoving = false;
  }

  requestAnimationFrame(frame);
}

function findNoTarget() {
  const wrapRect = wrap.getBoundingClientRect();
  const noRect = noBtn.getBoundingClientRect();
  const yesRect = yesBtn.getBoundingClientRect();

  const maxX = Math.max(0, wrapRect.width - noRect.width);
  const maxY = Math.max(0, wrapRect.height - noRect.height);

  let targetX = 0;
  let targetY = 0;

  const tries = 90;
  const safeGap = isPhoneLayout() ? 26 : 18;

  for (let i = 0; i < tries; i += 1) {
    targetX = Math.random() * maxX;
    targetY = Math.random() * maxY;

    const candidate = {
      left: wrapRect.left + targetX,
      right: wrapRect.left + targetX + noRect.width,
      top: wrapRect.top + targetY,
      bottom: wrapRect.top + targetY + noRect.height
    };

    if (!rectanglesOverlap(candidate, yesRect, safeGap)) {
      break;
    }
  }

  return {
    x: clamp(targetX, 0, maxX),
    y: clamp(targetY, 0, maxY)
  };
}

function moveNoButton() {
  if (noMoving || gameScreen.classList.contains("hidden")) {
    return;
  }

  noMoving = true;
  const target = findNoTarget();

  dodgeCount += 1;
  growYesButton();
  updateHint();

  animateNoWave(target.x, target.y);
}

function celebrate() {
  questionCard.classList.add("hidden");
  celebrateCard.classList.remove("hidden");
  celebrateCard.classList.add("card-enter");
  app.setAttribute("aria-live", "off");

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

function revealGameFromEnvelope() {
  if (envelopeOpened) {
    return;
  }

  envelopeOpened = true;
  envelopeButton.classList.add("opened");
  envelopeHint.textContent = "Opening your letter...";

  setTimeout(() => {
    envelopeScreen.classList.add("screen-fade-out");
  }, 650);

  setTimeout(() => {
    envelopeScreen.style.display = "none";
    gameScreen.classList.remove("hidden");
    gameScreen.classList.add("screen-fade-in");
    resetNoButtonPosition();
  }, 980);
}

envelopeButton.addEventListener("click", revealGameFromEnvelope);
yesBtn.addEventListener("animationend", () => {
  yesBtn.classList.remove("yes-pop");
});

yesBtn.addEventListener("click", celebrate);
noBtn.addEventListener("mouseenter", moveNoButton);
noBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  moveNoButton();
});

noBtn.addEventListener("click", (event) => {
  event.preventDefault();
  moveNoButton();
});

window.addEventListener("resize", () => {
  if (!gameScreen.classList.contains("hidden")) {
    resetNoButtonPosition();
  }
});

