/* =========================================================
   respond.js - 응답 화면 (respond.html)

   1. 모임 정보 불러오기 → 날짜 탭, 시간 블록 그리기
   2. 블록 누르기(모바일) / 끌어서 고르기(PC 마우스)
   3. 빠른 선택
   4. 이름 입력 → 예전 응답 불러오기
   5. 제출 → 저장 → 결과 화면으로 이동
   ========================================================= */


/* ---------- 화면 상태 ---------- */

const meetingId = getParam("id");
let meeting = null;        // 모임 정보
let timeList = [];         // ["12:00", "12:30", ...]
let activeDate = null;     // 지금 보고 있는 날짜 탭
const selected = new Set();   // 고른 칸들 {"2026-10-29 19:00", ...}
// Set = 중복 없는 묶음. add(넣기) / delete(빼기) / has(있는지) 를 빠르게 할 수 있어요.

// 마우스 끌기용 상태
let isDragging = false;    // 지금 끌고 있는지
let dragMode = true;       // 끄는 동안 칸을 "켜는지(true)" "끄는지(false)"
let mouseHandled = false;  // 마우스로 이미 처리했으면 click 에서 또 처리하지 않게


/* ---------- 요소 ---------- */

const nameInput = document.getElementById("my-name");
const nameHint = document.getElementById("name-hint");
const dateTabs = document.getElementById("date-tabs");
const grid = document.getElementById("time-grid");
const summary = document.getElementById("select-summary");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");


/* =========================================================
   1. 시작
   ========================================================= */

init();

async function init() {
  if (!requireFirebase()) return;
  if (!meetingId) {
    showFatal("응답 링크가 올바르지 않아요. 주최자에게 링크를 다시 받아 주세요.");
    return;
  }

  try {
    meeting = await getMeeting(meetingId);
  } catch (error) {
    console.error(error);
    showFatal("모임 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    return;
  }
  if (!meeting) {
    showFatal("모임을 찾을 수 없어요. 링크를 다시 확인해 주세요.");
    return;
  }

  timeList = getTimeList(meeting);
  activeDate = meeting.dates[0];

  // 모임 정보 채우기
  document.title = meeting.name + " · 모아그";
  document.getElementById("info-name").textContent = meeting.name;
  document.getElementById("info-detail").textContent = describeMeeting(meeting);
  document.getElementById("view-result").href = "result.html?id=" + meetingId;
  renderConfirmedBanner(meeting);

  renderTabs();
  renderGrid();
  updateSummary();

  // 이 브라우저에서 전에 쓴 이름이 있으면 채우고, 그 이름의 응답을 불러옴
  const savedName = loadMyName();
  if (savedName) {
    nameInput.value = savedName;
    await loadMyResponse();
  }
}


/* =========================================================
   2. 날짜 탭 + 시간 블록 그리기
   ========================================================= */

function renderTabs() {
  dateTabs.innerHTML = "";
  meeting.dates.forEach(function (date) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "date-tab";
    tab.dataset.date = date;
    if (date === activeDate) tab.classList.add("active");

    const dow = document.createElement("span");
    dow.className = "dow";
    dow.textContent = getDayName(date);
    const day = document.createElement("span");
    day.className = "day";
    day.textContent = formatMonthDay(date);
    tab.append(dow, day);

    tab.addEventListener("click", function () {
      activeDate = date;
      renderTabs();
      renderGrid();
      updateSummary();
    });
    dateTabs.appendChild(tab);
  });
  updateTabDots();
}

// 고른 칸이 있는 날짜 탭에 점(has-pick) 붙이기
function updateTabDots() {
  dateTabs.querySelectorAll(".date-tab").forEach(function (tab) {
    tab.classList.toggle("has-pick", countSelected(tab.dataset.date) > 0);
  });
}

// 그 날짜에 고른 칸 수
function countSelected(date) {
  let count = 0;
  selected.forEach(function (slot) {
    if (slot.startsWith(date + " ")) count++;
  });
  return count;
}

function renderGrid() {
  grid.innerHTML = "";
  timeList.forEach(function (time) {
    // 정각이면 줄 맨 앞에 시간 글자 넣기 → [글자][:00 블록][:30 블록] 3칸이 한 줄
    if (time.endsWith(":00")) {
      const label = document.createElement("div");
      label.className = "time-label";
      label.textContent = time;
      grid.appendChild(label);
    }

    const slot = makeSlotKey(activeDate, time);
    const block = document.createElement("button");
    block.type = "button";
    block.className = "block";
    block.dataset.slot = slot;        // 이 블록이 어떤 칸인지 적어 둠
    block.textContent = time.slice(2);   // "19:30" → ":30"
    block.title = time;
    if (selected.has(slot)) block.classList.add("selected");
    grid.appendChild(block);
  });
}

// 블록 하나를 켜거나(on=true) 끄기(on=false)
function setBlock(block, on) {
  if (on) {
    selected.add(block.dataset.slot);
  } else {
    selected.delete(block.dataset.slot);
  }
  block.classList.toggle("selected", on);
  updateSummary();
  updateTabDots();
}

function updateSummary() {
  const total = selected.size;
  if (total === 0) {
    summary.textContent = "아직 고른 시간이 없어요.";
    return;
  }
  summary.textContent = formatDate(activeDate) + " · " + countSelected(activeDate) + "칸 선택 · 전체 " +
    formatDuration(total * 30);
}


/* =========================================================
   3. 블록 고르기 (누르기 + 마우스로 끌기)

   - 모바일(터치): 칸을 "탭" 하면 켜고 끄기. 화면 스크롤은 그대로 돼요.
   - PC(마우스): 누른 채로 끌면 지나간 칸이 전부 같은 상태로 바뀜.
   이벤트를 블록마다 달지 않고 grid 하나에만 달아요(이벤트 위임).
   event.target.closest(".block") = 누른 곳에서 가장 가까운 블록 찾기
   ========================================================= */

grid.addEventListener("pointerdown", function (event) {
  const block = event.target.closest(".block");
  if (!block || event.pointerType !== "mouse" || event.button !== 0) return;
  event.preventDefault();   // 끄는 동안 글자가 파랗게 선택되는 것 방지

  isDragging = true;
  mouseHandled = true;
  // 처음 누른 칸이 꺼져 있었으면 "켜기 모드", 켜져 있었으면 "끄기 모드"
  dragMode = !selected.has(block.dataset.slot);
  setBlock(block, dragMode);
});

grid.addEventListener("pointerover", function (event) {
  if (!isDragging) return;
  const block = event.target.closest(".block");
  if (block) setBlock(block, dragMode);
});

// 마우스 버튼을 떼면 끌기 끝 (그리드 밖에서 떼도 끝나도록 document 에 달아요)
document.addEventListener("pointerup", function () {
  isDragging = false;
  // click 이벤트가 pointerup 바로 뒤에 오기 때문에, 그 뒤에 표시를 지워요
  setTimeout(function () { mouseHandled = false; }, 0);
});

// 터치·키보드로 누른 경우
grid.addEventListener("click", function (event) {
  const block = event.target.closest(".block");
  if (!block || mouseHandled) return;
  setBlock(block, !selected.has(block.dataset.slot));
});


/* =========================================================
   4. 빠른 선택
   ========================================================= */

document.querySelectorAll("[data-quick]").forEach(function (button) {
  button.addEventListener("click", function () {
    quickSelect(button.dataset.quick);
  });
});

function quickSelect(type) {
  if (type === "reset") {
    if (selected.size > 0 && confirm("고른 시간을 모두 지울까요?")) {
      selected.clear();
    }
  } else {
    let added = 0;
    meeting.dates.forEach(function (date) {
      timeList.forEach(function (time) {
        const minutes = timeToMinutes(time);
        let match = false;
        if (type === "weekday-evening") match = !isWeekend(date) && minutes >= 18 * 60;
        if (type === "weekend-afternoon") match = isWeekend(date) && minutes >= 12 * 60 && minutes < 18 * 60;
        if (type === "day-all") match = date === activeDate;

        if (match) {
          selected.add(makeSlotKey(date, time));   // 빠른 선택은 "더하기"만 해요
          added++;
        }
      });
    });
    if (added === 0) showToast("이 모임에는 해당하는 시간이 없어요.");
  }
  renderGrid();
  updateSummary();
  updateTabDots();
}


/* =========================================================
   5. 이름 → 예전 응답 불러오기
   ========================================================= */

// change = 입력칸에서 글자를 바꾸고 빠져나왔을 때
nameInput.addEventListener("change", loadMyResponse);

async function loadMyResponse() {
  const name = nameInput.value.trim();
  if (!name) return;

  try {
    const response = await getResponse(meetingId, name);
    if (response) {
      selected.clear();
      response.slots.forEach(function (slot) { selected.add(slot); });
      renderGrid();
      updateSummary();
      updateTabDots();
      nameHint.textContent = "✏️ 전에 낸 응답을 불러왔어요. 고친 뒤 제출하면 새 응답으로 바뀌어요.";
    } else {
      nameHint.textContent = "처음 응답하시는군요! 가능한 시간을 골라 주세요.";
    }
  } catch (error) {
    console.error(error);
  }
}


/* =========================================================
   6. 제출
   ========================================================= */

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

submitBtn.addEventListener("click", async function () {
  const name = nameInput.value.trim();
  if (!name) {
    showError("이름을 입력해 주세요.");
    nameInput.focus();
    return;
  }
  if (selected.size === 0 && !confirm("고른 시간이 없어요. '가능한 시간 없음'으로 제출할까요?")) {
    return;
  }
  formError.hidden = true;

  submitBtn.disabled = true;
  submitBtn.textContent = "제출하는 중...";
  try {
    // Set → 배열로 바꾸고 정렬해서 저장
    await saveResponse(meetingId, name, Array.from(selected).sort());
    saveMyName(name);
    location.href = "result.html?id=" + meetingId + "&submitted=1";
  } catch (error) {
    console.error(error);
    showError("제출하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
    submitBtn.disabled = false;
    submitBtn.textContent = "제출하기";
  }
});
