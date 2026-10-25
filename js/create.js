/* =========================================================
   create.js - 모임 만들기 화면 (index.html)

   1. 달력 그리기 + 날짜 고르기
   2. 시간 범위 선택지 채우기
   3. 진행 시간 칩 고르기
   4. "모임 만들기" → 입력 확인 → 저장 → 생성 완료 페이지로 이동
   ========================================================= */


/* ---------- 화면 상태 (지금 무엇이 골라져 있는지) ---------- */

const today = new Date();
today.setHours(0, 0, 0, 0);   // 시간은 0시로 맞춰서 "날짜"만 비교

let viewYear = today.getFullYear();   // 달력에 보이는 연도
let viewMonth = today.getMonth();     // 달력에 보이는 달 (0 = 1월)
let selectedDates = [];               // 고른 날짜들 ["2026-10-26", ...]
let selectedDuration = 120;           // 진행 시간(분)


/* ---------- 자주 쓰는 요소 찾아 두기 ---------- */

const nameInput = document.getElementById("meeting-name");
const calendar = document.getElementById("calendar");
const calTitle = document.getElementById("cal-title");
const calPrev = document.getElementById("cal-prev");
const calNext = document.getElementById("cal-next");
const dateHint = document.getElementById("date-hint");
const startSelect = document.getElementById("start-hour");
const endSelect = document.getElementById("end-hour");
const membersInput = document.getElementById("members");
const createBtn = document.getElementById("create-btn");
const formError = document.getElementById("form-error");


/* =========================================================
   1. 달력
   ========================================================= */

function renderCalendar() {
  calendar.innerHTML = "";   // 이전 달력 지우기
  calTitle.textContent = viewYear + "년 " + (viewMonth + 1) + "월";

  // 이번 달보다 이전 달로는 못 가게
  calPrev.disabled = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  // (1) 요일 머리글 (월요일부터 시작)
  ["월", "화", "수", "목", "금", "토", "일"].forEach(function (name) {
    const head = document.createElement("div");
    head.className = "cal-head";
    head.textContent = name;
    calendar.appendChild(head);
  });

  // (2) 1일 앞쪽 빈칸. getDay()는 일요일=0 이라서, 월요일=0 이 되도록 바꿔 계산
  const firstDay = new Date(viewYear, viewMonth, 1);
  const blankCount = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < blankCount; i++) {
    calendar.appendChild(document.createElement("div"));
  }

  // (3) 날짜 버튼. "다음 달의 0일" = 이번 달의 마지막 날
  const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
  for (let day = 1; day <= lastDate; day++) {
    const date = new Date(viewYear, viewMonth, day);
    const key = toDateKey(date);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cal-day";
    button.textContent = day;

    if (date < today) {
      button.classList.add("past");
      button.disabled = true;   // 지난 날짜는 못 고름
    }
    if (date.getTime() === today.getTime()) button.classList.add("today");
    if (selectedDates.includes(key)) button.classList.add("selected");

    button.addEventListener("click", function () {
      toggleDate(key, button);
    });
    calendar.appendChild(button);
  }
}

// 날짜를 누르면: 골라져 있으면 빼고, 아니면 넣기
function toggleDate(key, button) {
  if (selectedDates.includes(key)) {
    selectedDates = selectedDates.filter(function (d) { return d !== key; });
    button.classList.remove("selected");
  } else {
    selectedDates.push(key);
    button.classList.add("selected");
  }
  selectedDates.sort();   // "YYYY-MM-DD" 글자는 가나다순으로 정렬하면 날짜순이 돼요
  updateDateHint();
}

function updateDateHint() {
  if (selectedDates.length === 0) {
    dateHint.textContent = "날짜를 눌러서 후보를 골라 주세요. 여러 개 고를 수 있어요.";
  } else if (selectedDates.length === 1) {
    dateHint.textContent = "1일 선택됨 · " + formatDate(selectedDates[0]);
  } else {
    dateHint.textContent = selectedDates.length + "일 선택됨 · " +
      formatDate(selectedDates[0]) + " ~ " + formatDate(selectedDates[selectedDates.length - 1]);
  }
}

// 달 이동 화살표
function moveMonth(step) {
  const moved = new Date(viewYear, viewMonth + step, 1);   // 13월 → 다음 해 1월 자동 처리
  viewYear = moved.getFullYear();
  viewMonth = moved.getMonth();
  renderCalendar();
}

calPrev.addEventListener("click", function () { moveMonth(-1); });
calNext.addEventListener("click", function () { moveMonth(1); });


/* =========================================================
   2. 시간 범위 선택지 (06:00 ~ 24:00)
   ========================================================= */

function fillHourOptions(select, fromHour, toHour, selectedHour) {
  for (let hour = fromHour; hour <= toHour; hour++) {
    const option = document.createElement("option");
    option.value = hour;
    option.textContent = twoDigits(hour) + ":00";
    if (hour === selectedHour) option.selected = true;
    select.appendChild(option);
  }
}


/* =========================================================
   3. 진행 시간 칩 (하나만 고를 수 있음)
   ========================================================= */

const durationChips = document.querySelectorAll("#duration-chips .chip");
durationChips.forEach(function (chip) {
  chip.addEventListener("click", function () {
    durationChips.forEach(function (other) { other.classList.remove("selected"); });
    chip.classList.add("selected");
    selectedDuration = Number(chip.dataset.minutes);   // data-minutes 값 읽기
  });
});


/* =========================================================
   4. 모임 만들기
   ========================================================= */

// "김민준, 이서연\n박지호" → ["김민준", "이서연", "박지호"] (빈칸·중복 제거)
function parseMembers(text) {
  const names = text.split(/[,\n]/)
    .map(function (name) { return name.trim(); })
    .filter(function (name) { return name !== ""; });
  return [...new Set(names)];   // Set = 중복 없는 묶음
}

// 입력이 올바른지 검사. 문제가 있으면 안내 문구, 없으면 "" 를 돌려줌
function validate(name, startHour, endHour, members) {
  if (name === "") return "모임 이름을 입력해 주세요.";
  if (selectedDates.length === 0) return "후보 날짜를 하나 이상 골라 주세요.";
  if (selectedDates.length > 60) return "후보 날짜는 60일까지 고를 수 있어요.";
  if (endHour <= startHour) return "종료 시간은 시작 시간보다 늦어야 해요.";
  if (selectedDuration > (endHour - startHour) * 60) return "진행 시간이 시간 범위보다 길어요.";
  if (members.some(function (m) { return m.length > 20; })) return "참여자 이름은 20자까지 쓸 수 있어요.";
  if (members.length > 100) return "참여자 명단은 100명까지 적을 수 있어요.";
  return "";
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

createBtn.addEventListener("click", async function () {
  const name = nameInput.value.trim();
  const startHour = Number(startSelect.value);
  const endHour = Number(endSelect.value);
  const members = parseMembers(membersInput.value);

  const error = validate(name, startHour, endHour, members);
  if (error) {
    showError(error);
    return;
  }
  if (!firebaseReady) {
    showError("Firebase 설정이 아직 없어요. js/firebase-config.js 를 채워 주세요. (README.md 참고)");
    return;
  }
  formError.hidden = true;

  // 저장하는 동안 버튼을 잠가서 두 번 눌리지 않게
  createBtn.disabled = true;
  createBtn.textContent = "만드는 중...";

  try {
    const result = await createMeeting({
      name: name,
      dates: selectedDates,
      startHour: startHour,
      endHour: endHour,
      duration: selectedDuration,
      members: members
    });
    // 생성 완료 페이지로 이동 (관리 키도 함께 전달)
    location.href = "created.html?id=" + result.id + "&key=" + result.key;
  } catch (err) {
    console.error(err);
    showError("모임을 만들지 못했어요. 인터넷 연결이나 Firebase 설정을 확인해 주세요.");
    createBtn.disabled = false;
    createBtn.textContent = "모임 만들기";
  }
});


/* ---------- 처음 화면 그리기 ---------- */
renderCalendar();
updateDateHint();
fillHourOptions(startSelect, 6, 23, 12);   // 06:00 ~ 23:00, 기본 12:00
fillHourOptions(endSelect, 7, 24, 22);     // 07:00 ~ 24:00, 기본 22:00
