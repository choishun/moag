/* =========================================================
   utils.js - 여러 페이지에서 같이 쓰는 작은 도우미 함수 모음

   날짜는 "2026-10-29" 같은 글자(날짜 키)로,
   시간은 "19:30" 같은 글자로 다룹니다.
   30분 칸 하나는 "2026-10-29 19:30" 처럼 날짜 + 공백 + 시간 (슬롯 키)
   ========================================================= */

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];


/* ---------- 주소(URL) ---------- */

// 주소의 ? 뒤 값 읽기. 예) respond.html?id=abc → getParam("id") = "abc"
function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}


/* ---------- 날짜 ---------- */

// 숫자를 두 자리 글자로: 9 → "09"
function twoDigits(number) {
  return String(number).padStart(2, "0");
}

// Date → "2026-10-29"
// (toISOString 은 세계 표준시 기준이라 한국 날짜와 하루 어긋날 수 있어서 직접 만들어요)
function toDateKey(date) {
  return date.getFullYear() + "-" + twoDigits(date.getMonth() + 1) + "-" + twoDigits(date.getDate());
}

// "2026-10-29" → Date
function parseDateKey(key) {
  const parts = key.split("-").map(Number);   // [2026, 10, 29]
  return new Date(parts[0], parts[1] - 1, parts[2]);   // 월은 0부터 시작이라 -1
}

// "2026-10-29" → "목"
function getDayName(key) {
  return DAY_NAMES[parseDateKey(key).getDay()];
}

// "2026-10-29" → "10/29"
function formatMonthDay(key) {
  const date = parseDateKey(key);
  return (date.getMonth() + 1) + "/" + date.getDate();
}

// "2026-10-29" → "10/29(목)"
function formatDate(key) {
  return formatMonthDay(key) + "(" + getDayName(key) + ")";
}

// 토요일 또는 일요일인지
function isWeekend(key) {
  const day = parseDateKey(key).getDay();
  return day === 0 || day === 6;
}


/* ---------- 시간 ---------- */

// 분 → "HH:MM". 예) 1170 → "19:30"
function minutesToTime(minutes) {
  return twoDigits(Math.floor(minutes / 60)) + ":" + twoDigits(minutes % 60);
}

// "19:30" → 1170 (분)
function timeToMinutes(time) {
  const parts = time.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

// 모임의 30분 칸 시작 시간 목록. 12~22시 모임이면 ["12:00", "12:30", ..., "21:30"]
function getTimeList(meeting) {
  const list = [];
  for (let minutes = meeting.startHour * 60; minutes < meeting.endHour * 60; minutes += 30) {
    list.push(minutesToTime(minutes));
  }
  return list;
}

// 날짜 + 시간 → 슬롯 키 "2026-10-29 19:30"
function makeSlotKey(dateKey, time) {
  return dateKey + " " + time;
}

// 120 → "2시간", 90 → "1시간 30분", 30 → "30분"
function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return rest + "분";
  if (rest === 0) return hours + "시간";
  return hours + "시간 " + rest + "분";
}

// "10/29(목) 19:00~21:00"
function formatTimeRange(dateKey, startTime, durationMinutes) {
  const endTime = minutesToTime(timeToMinutes(startTime) + durationMinutes);
  return formatDate(dateKey) + " " + startTime + "~" + endTime;
}

// 모임 요약 한 줄: "10/26(월) ~ 11/1(일) 중 7일 · 12:00~22:00 · 2시간 진행"
function describeMeeting(meeting) {
  const dates = meeting.dates;
  let datePart = formatDate(dates[0]);
  if (dates.length > 1) {
    datePart += " ~ " + formatDate(dates[dates.length - 1]) + " 중 " + dates.length + "일";
  }
  const timePart = twoDigits(meeting.startHour) + ":00~" + twoDigits(meeting.endHour) + ":00";
  return datePart + " · " + timePart + " · " + formatDuration(meeting.duration) + " 진행";
}


/* ---------- 기타 ---------- */

// 무작위 아이디 만들기 (모임 주소, 관리 키에 사용)
// 헷갈리는 글자(l, o, 0, 1)는 뺐어요.
function randomId(length) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";   // 32글자
  const values = crypto.getRandomValues(new Uint32Array(length));   // 안전한 난수
  let id = "";
  values.forEach(function (value) {
    id += chars[value % chars.length];
  });
  return id;
}

// 글자를 클립보드에 복사. 성공하면 true
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // https 가 아닌 곳(파일 직접 열기 등)에서는 위 방법이 막혀서, 예전 방식으로 한 번 더 시도
    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    const ok = document.execCommand("copy");
    temp.remove();
    return ok;
  }
}

// 화면 아래에 잠깐 떴다 사라지는 알림
let toastTimer = null;
function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.classList.remove("show");
  }, 2000);
}

// 더 진행할 수 없을 때(잘못된 링크 등) 본문을 안내 문구로 바꿈
function showFatal(message) {
  const main = document.querySelector(".main");
  main.innerHTML = "";

  const box = document.createElement("div");
  box.className = "empty";
  box.textContent = message;

  const group = document.createElement("div");
  group.className = "btn-group";
  const link = document.createElement("a");
  link.className = "btn";
  link.href = "index.html";
  link.textContent = "새 모임 만들기";
  group.appendChild(link);

  main.append(box, group);
}

// "확정된 시간" 띠 표시 (응답·결과 페이지 공용)
function renderConfirmedBanner(meeting) {
  const banner = document.getElementById("confirmed-banner");
  if (!banner) return;
  if (meeting.confirmed) {
    banner.textContent = "📌 확정된 시간: " +
      formatTimeRange(meeting.confirmed.date, meeting.confirmed.start, meeting.duration);
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

// 내 이름을 이 브라우저에 기억 (다음에 응답 수정할 때 자동 입력용)
// localStorage 는 막혀 있을 수도 있어서 try 로 감싸요.
function saveMyName(name) {
  try { localStorage.setItem("moag-name", name); } catch (error) { /* 못 써도 괜찮음 */ }
}

function loadMyName() {
  try { return localStorage.getItem("moag-name") || ""; } catch (error) { return ""; }
}
