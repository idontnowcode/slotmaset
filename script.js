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
const resultHeadline = document.getElementById("resultHeadline");
const resultSentence = document.getElementById("resultSentence");
const statusPill = document.getElementById("statusPill");

let isSpinning = false;
let latestResult = null;

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

function animateSlot(slot, targetIndex, duration) {
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
  statusPill.textContent = "SPINNING";
  statusPill.classList.add("is-spinning");
  statusPill.classList.remove("is-finished");

  const result = {
    object1: objects[randomIndex(objects)],
    object2: objects[randomIndex(objects)],
    attribute: attributes[randomIndex(attributes)],
  };

  if (result.object1 === result.object2) {
    result.object2 = objects[(objects.indexOf(result.object2) + 3) % objects.length];
  }

  latestResult = result;
  updateResult({
    object1: "???",
    object2: "???",
    attribute: "...",
  });

  await Promise.all([
    animateSlot(slots[0], objects.indexOf(result.object1), 1700),
    animateSlot(slots[1], objects.indexOf(result.object2), 2200),
    animateSlot(slots[2], attributes.indexOf(result.attribute), 2800),
  ]);

  updateResult(result);
  statusPill.textContent = "COMPLETE";
  statusPill.classList.remove("is-spinning");
  statusPill.classList.add("is-finished");
  spinButton.disabled = false;
  surpriseButton.disabled = false;
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
