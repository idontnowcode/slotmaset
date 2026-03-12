const objects = [
  "나무", "돌", "개구리", "폭포", "불꽃",
  "구름", "수정", "늑대", "시계", "유성",
];

const attributes = [
  "희망", "절망", "물", "불", "독",
  "빛", "어둠", "바람", "번개", "꿈",
];

const resultHeadline = document.getElementById("resultHeadline");
const resultSentence  = document.getElementById("resultSentence");
const statusPill      = document.getElementById("statusPill");
const replayButton    = document.getElementById("replayButton");

const machineState = [
  {
    list: objects,
    displayEl: document.getElementById("gacha1"),
    domeEl:    document.getElementById("dome1"),
    machineEl: document.getElementById("machine1"),
    btnEl:     document.getElementById("spinBtn1"),
    result: null,
    spinning: false,
  },
  {
    list: objects,
    displayEl: document.getElementById("gacha2"),
    domeEl:    document.getElementById("dome2"),
    machineEl: document.getElementById("machine2"),
    btnEl:     document.getElementById("spinBtn2"),
    result: null,
    spinning: false,
  },
  {
    list: attributes,
    displayEl: document.getElementById("gacha3"),
    domeEl:    document.getElementById("dome3"),
    machineEl: document.getElementById("machine3"),
    btnEl:     document.getElementById("spinBtn3"),
    result: null,
    spinning: false,
  },
];

let latestResult = null;
let audioContext  = null;

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
  const osc  = ctx.createOscillator();
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

  const bandPass   = ctx.createBiquadFilter();
  const loopGain   = ctx.createGain();
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const channel    = noiseBuffer.getChannelData(0);

  for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * 0.3;

  bandPass.type          = "bandpass";
  bandPass.frequency.value = 680;
  bandPass.Q.value       = 0.8;
  loopGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  loopGain.gain.exponentialRampToValueAtTime(0.025, ctx.currentTime + 0.05);

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop   = true;

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
  const knob = machineEl.querySelector(".knob-dial");
  if (!knob) return;
  knob.style.animation = "none";
  void knob.offsetWidth;
  knob.style.animation = "knobSpin 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97)";
}

function animateBall(machineEl) {
  const ball = machineEl.querySelector(".gacha-ball");
  if (!ball) return;
  ball.style.animation = "none";
  void ball.offsetWidth;
  ball.style.animation = "ballPop 1.5s ease-out forwards";
}

function updateCombinedResult() {
  const allDone = machineState.every(s => s.result !== null);
  if (!allDone) return;

  const obj1 = machineState[0].result;
  const obj2 = machineState[1].result;
  const attr = machineState[2].result;

  latestResult = { object1: obj1, object2: obj2, attribute: attr };
  resultHeadline.textContent = `${attr}의 ${obj1} ${obj2}`;
  resultSentence.textContent  = `${attr} 속성을 머금은 ${obj1}와 ${obj2}의 조합입니다. 캐릭터 설정, 몬스터 이름, 세계관 아이디어의 시작점으로 써보세요.`;
  playJackpotSound();
  statusPill.textContent = "COMPLETE";
}

function spinMachine(state) {
  if (state.spinning) return;
  state.spinning = true;
  state.btnEl.disabled = true;

  // Pick result now (hidden until reveal)
  const target = state.list[Math.floor(Math.random() * state.list.length)];

  // Clear dome
  state.displayEl.textContent = "";
  state.domeEl.classList.remove("is-landed");

  // Knob animation + sound
  animateCrank(state.machineEl);
  playCrankSound();
  statusPill.textContent = "SPINNING";

  // Spin loop sound — stop after ball fades
  const spinLoop = startSpinLoop();
  setTimeout(() => spinLoop.stop(), 1400);

  // Ball appears shortly after knob starts
  setTimeout(() => animateBall(state.machineEl), 350);

  // Reveal result in dome after ball animation completes
  setTimeout(() => {
    state.result = target;
    state.displayEl.textContent = target;
    state.domeEl.classList.add("is-landed");
    playItemStopSound();
    state.spinning = false;
    state.btnEl.disabled = false;
    updateCombinedResult();
  }, 1850);
}

function replayResult() {
  if (!latestResult) return;
  const { object1, object2, attribute } = latestResult;
  resultHeadline.textContent = `${attribute}의 ${object1} ${object2}`;
  resultSentence.textContent  = `${attribute} 속성을 머금은 ${object1}와 ${object2}의 조합입니다. 캐릭터 설정, 몬스터 이름, 세계관 아이디어의 시작점으로 써보세요.`;
}

machineState.forEach(state => {
  state.btnEl.addEventListener("click", () => spinMachine(state));
});

replayButton.addEventListener("click", replayResult);
