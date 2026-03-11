const ITEM_HEIGHT = 110;
const REPEAT_COUNT = 7;

const objects = [
  "나무",
  "돌",
  "개구리",
  "폭포",
  "불꽃",
  "구름",
  "수정",
  "늑대",
  "시계",
  "유성",
];

const attributes = [
  "희망",
  "절망",
  "물",
  "불",
  "독",
  "빛",
  "어둠",
  "바람",
  "번개",
  "꿈",
];

const slots = [
  {
    track: document.getElementById("slot1Track"),
    list: objects,
  },
  {
    track: document.getElementById("slot2Track"),
    list: objects,
  },
  {
    track: document.getElementById("slot3Track"),
    list: attributes,
  },
];

const spinButton = document.getElementById("spinButton");
const surpriseButton = document.getElementById("surpriseButton");
const leverButton = document.getElementById("leverButton");
const machinePanel = document.getElementById("machinePanel");
const resultHeadline = document.getElementById("resultHeadline");
const resultSentence = document.getElementById("resultSentence");
const statusPill = document.getElementById("statusPill");

let isSpinning = false;
let latestResult = null;
let audioContext = null;

function repeatItems(list) {
  return Array.from({ length: REPEAT_COUNT }, () => list).flat();
}

function buildSlot(track, list) {
  track.innerHTML = "";

  repeatItems(list).forEach((item) => {
    const cell = document.createElement("div");
    cell.className = "slot-item";
    cell.textContent = item;
    track.appendChild(cell);
  });
}

function setTrackPosition(track, visibleIndex) {
  track.style.transition = "none";
  track.style.transform = `translateY(-${visibleIndex * ITEM_HEIGHT}px)`;
}

function renderInitialSlots() {
  slots.forEach((slot, index) => {
    buildSlot(slot.track, slot.list);
    const startIndex = index === 2 ? 0 : index + 1;
    setTrackPosition(slot.track, startIndex);
  });
}

function randomIndex(list) {
  return Math.floor(Math.random() * list.length);
}

function createNarration(object1, object2, attribute) {
  return `${attribute}의 ${object1} ${object2}`;
}

function createDescription(object1, object2, attribute) {
  return `${attribute} 속성을 머금은 ${object1}와 ${object2}의 조합입니다. 캐릭터 설정, 몬스터 이름, 세계관 아이디어의 시작점으로 써보세요.`;
}

function updateResult(result) {
  const { object1, object2, attribute } = result;
  resultHeadline.textContent = createNarration(object1, object2, attribute);
  resultSentence.textContent = createDescription(object1, object2, attribute);
}

function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playTone({ frequency, duration, type = "sine", volume = 0.05, attack = 0.01, release = 0.08, when = 0 }) {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }

  const startTime = ctx.currentTime + when;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + release + 0.02);
}

function playLeverSound() {
  playTone({ frequency: 180, duration: 0.08, type: "triangle", volume: 0.04 });
  playTone({ frequency: 120, duration: 0.12, type: "square", volume: 0.025, when: 0.04 });
}

function playReelStopSound(delay = 0) {
  playTone({ frequency: 760, duration: 0.03, type: "square", volume: 0.032, when: delay });
  playTone({ frequency: 520, duration: 0.05, type: "triangle", volume: 0.028, when: delay + 0.02 });
}

function playJackpotSound() {
  playTone({ frequency: 523.25, duration: 0.1, type: "triangle", volume: 0.035, when: 0.00 });
  playTone({ frequency: 659.25, duration: 0.11, type: "triangle", volume: 0.035, when: 0.10 });
  playTone({ frequency: 783.99, duration: 0.13, type: "triangle", volume: 0.035, when: 0.22 });
}

function startSpinLoop() {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return { stop() {} };
  }

  const bandPass = ctx.createBiquadFilter();
  const loopGain = ctx.createGain();
  const noiseGain = ctx.createGain();
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);

  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * 0.35;
  }

  bandPass.type = "bandpass";
  bandPass.frequency.value = 760;
  bandPass.Q.value = 0.7;

  loopGain.gain.value = 0.0001;
  loopGain.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 0.04);

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  const motorOscillator = ctx.createOscillator();
  const motorGain = ctx.createGain();
  motorOscillator.type = "sawtooth";
  motorOscillator.frequency.setValueAtTime(38, ctx.currentTime);
  motorGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  motorGain.gain.exponentialRampToValueAtTime(0.02, ctx.currentTime + 0.06);

  noiseSource.connect(noiseGain);
  noiseGain.gain.value = 1;
  noiseGain.connect(bandPass);
  bandPass.connect(loopGain);
  motorOscillator.connect(motorGain);
  motorGain.connect(loopGain);
  loopGain.connect(ctx.destination);

  noiseSource.start();
  motorOscillator.start();

  return {
    stop() {
      const stopTime = ctx.currentTime;
      loopGain.gain.cancelScheduledValues(stopTime);
      loopGain.gain.setValueAtTime(Math.max(loopGain.gain.value, 0.0001), stopTime);
      loopGain.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.16);
      motorGain.gain.cancelScheduledValues(stopTime);
      motorGain.gain.setValueAtTime(Math.max(motorGain.gain.value, 0.0001), stopTime);
      motorGain.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.14);
      noiseSource.stop(stopTime + 0.18);
      motorOscillator.stop(stopTime + 0.18);
    },
  };
}

function pullLever() {
  if (!leverButton) {
    return;
  }

  leverButton.classList.remove("is-pulled");
  void leverButton.offsetWidth;
  leverButton.classList.add("is-pulled");
  window.setTimeout(() => {
    leverButton.classList.remove("is-pulled");
  }, 280);
}

function animateSlot(slot, targetIndex, duration, stopDelay = 0) {
  return new Promise((resolve) => {
    const baseCycles = 4 + Math.floor(Math.random() * 2);
    const finalIndex = targetIndex + slot.list.length * baseCycles;
    const distance = finalIndex * ITEM_HEIGHT;
    const track = slot.track;
    const windowEl = track.parentElement;

    windowEl.classList.remove("is-winning");
    void windowEl.offsetWidth;

    track.style.transition = "none";
    track.style.transform = "translateY(0)";

    requestAnimationFrame(() => {
      track.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.78, 0.18, 1)`;
      track.style.transform = `translateY(-${distance}px)`;
    });

    window.setTimeout(() => {
      track.style.transition = "none";
      track.style.transform = `translateY(-${targetIndex * ITEM_HEIGHT}px)`;
      windowEl.classList.add("is-winning");
      playReelStopSound(stopDelay);
      resolve();
    }, duration + 40);
  });
}

async function spin() {
  if (isSpinning) {
    return;
  }

  isSpinning = true;
  spinButton.disabled = true;
  surpriseButton.disabled = true;
  if (leverButton) {
    leverButton.disabled = true;
  }

  pullLever();
  playLeverSound();
  const spinLoop = startSpinLoop();

  statusPill.textContent = "SPINNING";
  machinePanel.classList.add("is-spinning");

  const result = {
    object1: objects[randomIndex(objects)],
    object2: objects[randomIndex(objects)],
    attribute: attributes[randomIndex(attributes)],
  };

  if (result.object1 === result.object2) {
    result.object2 = objects[(objects.indexOf(result.object2) + 3) % objects.length];
  }

  latestResult = result;
  updateResult({ object1: "???", object2: "???", attribute: "..." });

  await Promise.all([
    animateSlot(slots[0], objects.indexOf(result.object1), 1700, 0),
    animateSlot(slots[1], objects.indexOf(result.object2), 2200, 0.03),
    animateSlot(slots[2], attributes.indexOf(result.attribute), 2800, 0.06),
  ]);

  spinLoop.stop();
  playJackpotSound();
  updateResult(result);
  statusPill.textContent = "COMPLETE";
  machinePanel.classList.remove("is-spinning");
  spinButton.disabled = false;
  surpriseButton.disabled = false;
  if (leverButton) {
    leverButton.disabled = false;
  }
  isSpinning = false;
}

function replayResult() {
  if (!latestResult || isSpinning) {
    return;
  }

  updateResult(latestResult);
}

renderInitialSlots();
spinButton.addEventListener("click", spin);
surpriseButton.addEventListener("click", replayResult);
if (leverButton) {
  leverButton.addEventListener("click", spin);
}
