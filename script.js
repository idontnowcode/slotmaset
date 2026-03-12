const objects = [
  "나무", "돌", "개구리", "폭포", "불꽃",
  "구름", "수정", "늑대", "시계", "유성",
];

const attributes = [
  "희망", "절망", "물", "불", "독",
  "빛", "어둠", "바람", "번개", "꿈",
];

const gacha1 = document.getElementById("gacha1");
const gacha2 = document.getElementById("gacha2");
const gacha3 = document.getElementById("gacha3");
const dome1 = document.getElementById("dome1");
const dome2 = document.getElementById("dome2");
const dome3 = document.getElementById("dome3");
const machine1 = document.getElementById("machine1");
const machine2 = document.getElementById("machine2");
const machine3 = document.getElementById("machine3");
const spinButton = document.getElementById("spinButton");
const replayButton = document.getElementById("replayButton");
const resultHeadline = document.getElementById("resultHeadline");
const resultSentence = document.getElementById("resultSentence");
const statusPill = document.getElementById("statusPill");

let isSpinning = false;
let latestResult = null;
let audioContext = null;

function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone({ frequency, duration, type = "sine", volume = 0.05, attack = 0.01, release = 0.08, when = 0 }) {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const startTime = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + release + 0.02);
}

function playCrankSound() {
  playTone({ frequency: 220, duration: 0.06, type: "square",   volume: 0.035 });
  playTone({ frequency: 150, duration: 0.10, type: "triangle", volume: 0.028, when: 0.05 });
  playTone({ frequency: 280, duration: 0.05, type: "sawtooth", volume: 0.02,  when: 0.10 });
}

function playItemStopSound(delay = 0) {
  playTone({ frequency: 880, duration: 0.04, type: "square",   volume: 0.03,  when: delay });
  playTone({ frequency: 600, duration: 0.06, type: "triangle", volume: 0.025, when: delay + 0.03 });
}

function playJackpotSound() {
  playTone({ frequency: 523.25, duration: 0.1,  type: "triangle", volume: 0.035, when: 0.00 });
  playTone({ frequency: 659.25, duration: 0.11, type: "triangle", volume: 0.035, when: 0.10 });
  playTone({ frequency: 783.99, duration: 0.13, type: "triangle", volume: 0.035, when: 0.22 });
}

function startSpinLoop() {
  const ctx = ensureAudioContext();
  if (!ctx) return { stop() {} };

  const bandPass = ctx.createBiquadFilter();
  const loopGain = ctx.createGain();
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);

  for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * 0.3;

  bandPass.type = "bandpass";
  bandPass.frequency.value = 680;
  bandPass.Q.value = 0.8;
  loopGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  loopGain.gain.exponentialRampToValueAtTime(0.025, ctx.currentTime + 0.05);

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  noiseSource.connect(bandPass);
  bandPass.connect(loopGain);
  loopGain.connect(ctx.destination);
  noiseSource.start();

  return {
    stop() {
      const t = ctx.currentTime;
      loopGain.gain.cancelScheduledValues(t);
      loopGain.gain.setValueAtTime(Math.max(loopGain.gain.value, 0.0001), t);
      loopGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      noiseSource.stop(t + 0.2);
    },
  };
}

function animateCrank(machineEl) {
  machineEl.classList.remove("is-cranking");
  void machineEl.offsetWidth;
  machineEl.classList.add("is-cranking");
  setTimeout(() => machineEl.classList.remove("is-cranking"), 520);
}

function animateGacha(displayEl, domeEl, list, targetItem, totalDuration) {
  return new Promise((resolve) => {
    domeEl.classList.remove("is-landed");
    displayEl.classList.add("is-spinning");

    // Build a schedule of increasing intervals (fast → slow)
    const schedule = [];
    let elapsed = 0;
    let interval = 65;

    while (elapsed < totalDuration - 400) {
      schedule.push(interval);
      elapsed += interval;
      interval = Math.min(interval * 1.072, 380);
    }

    let i = 0;

    function next() {
      if (i < schedule.length) {
        displayEl.textContent = list[Math.floor(Math.random() * list.length)];
        setTimeout(next, schedule[i++]);
      } else {
        displayEl.textContent = targetItem;
        displayEl.classList.remove("is-spinning");
        domeEl.classList.add("is-landed");
        resolve();
      }
    }

    next();
  });
}

function updateResult({ object1, object2, attribute }) {
  resultHeadline.textContent = `${attribute}의 ${object1} ${object2}`;
  resultSentence.textContent = `${attribute} 속성을 머금은 ${object1}와 ${object2}의 조합입니다. 캐릭터 설정, 몬스터 이름, 세계관 아이디어의 시작점으로 써보세요.`;
}

async function spin() {
  if (isSpinning) return;

  isSpinning = true;
  spinButton.disabled = true;
  replayButton.disabled = true;

  [machine1, machine2, machine3].forEach((m, idx) => {
    setTimeout(() => animateCrank(m), idx * 80);
  });
  playCrankSound();
  const spinLoop = startSpinLoop();

  statusPill.textContent = "SPINNING";

  const result = {
    object1: objects[Math.floor(Math.random() * objects.length)],
    object2: objects[Math.floor(Math.random() * objects.length)],
    attribute: attributes[Math.floor(Math.random() * attributes.length)],
  };

  if (result.object1 === result.object2) {
    result.object2 = objects[(objects.indexOf(result.object2) + 3) % objects.length];
  }

  latestResult = result;
  resultHeadline.textContent = "뽑는 중...";
  resultSentence.textContent = "";

  await Promise.all([
    animateGacha(gacha1, dome1, objects,     result.object1,   1700),
    animateGacha(gacha2, dome2, objects,     result.object2,   2300).then(() => playItemStopSound()),
    animateGacha(gacha3, dome3, attributes,  result.attribute, 2900).then(() => playItemStopSound(0.02)),
  ]);

  spinLoop.stop();
  playJackpotSound();
  updateResult(result);
  statusPill.textContent = "COMPLETE";
  spinButton.disabled = false;
  replayButton.disabled = false;
  isSpinning = false;
}

function replayResult() {
  if (!latestResult || isSpinning) return;
  updateResult(latestResult);
}

spinButton.addEventListener("click", spin);
replayButton.addEventListener("click", replayResult);
