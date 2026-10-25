/* =========================================================
   result.js - 결과 화면 (result.html)

   1. 모임 + 응답을 "실시간"으로 불러오기 (누가 응답하면 바로 화면이 바뀜)
   2. 추천 TOP 3 계산 + 카드 그리기 (주최자는 확정 버튼)
   3. 히트맵 그리기
   4. 응답 현황 그리기
   ========================================================= */


/* ---------- 화면 상태 ---------- */

const meetingId = getParam("id");
const adminKey = getParam("key");
let meeting = null;      // 모임 정보
let responses = null;    // 응답 목록 [{ name, slots }, ...]
let isHost = false;      // 주최자인지


/* =========================================================
   1. 시작
   ========================================================= */

init();

async function init() {
  if (!requireFirebase()) return;
  if (!meetingId) {
    showFatal("링크가 올바르지 않아요. 링크를 다시 확인해 주세요.");
    return;
  }

  try {
    meeting = await getMeeting(meetingId);
    if (meeting && adminKey) {
      isHost = await isAdmin(meetingId, adminKey);
    }
  } catch (error) {
    console.error(error);
    showFatal("모임 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    return;
  }
  if (!meeting) {
    showFatal("모임을 찾을 수 없어요. 링크를 다시 확인해 주세요.");
    return;
  }

  // 주최자면 <body class="host"> → CSS 가 host-only 를 보여 줌
  if (isHost) {
    document.body.classList.add("host");
    document.getElementById("share-link").href = "created.html?id=" + meetingId + "&key=" + adminKey;
  } else if (adminKey) {
    showToast("관리 링크가 올바르지 않아서 응답자 화면으로 보여요.");
  }
  document.getElementById("edit-link").href = "respond.html?id=" + meetingId;
  if (getParam("submitted")) {
    document.getElementById("submitted-box").hidden = false;
  }

  // 실시간 감시: 값이 바뀔 때마다 아래 함수가 다시 불려요
  watchMeeting(meetingId, function (data) {
    meeting = data;
    render();
  });
  watchResponses(meetingId, function (list) {
    responses = list;
    render();
  });
}

// 화면 전체 다시 그리기
function render() {
  if (!meeting || !responses) return;   // 둘 다 도착해야 그릴 수 있음

  document.title = meeting.name + " 결과 · 모아그";
  document.getElementById("meeting-title").textContent = meeting.name;
  document.getElementById("meeting-desc").textContent = describeMeeting(meeting);
  renderConfirmedBanner(meeting);

  renderTopList();
  renderHeatmap();
  renderStatus();
}


/* =========================================================
   공통 계산: 칸별로 가능한 사람 이름 모으기
   결과 예) { "2026-10-29 19:00": ["김민준", "이서연"], ... }
   ========================================================= */

function getNamesBySlot() {
  const namesBySlot = {};
  responses.forEach(function (response) {
    response.slots.forEach(function (slot) {
      if (!namesBySlot[slot]) namesBySlot[slot] = [];
      namesBySlot[slot].push(response.name);
    });
  });
  return namesBySlot;
}


/* =========================================================
   2. 추천 TOP 3

   [계산 방법]
   - 진행 시간이 2시간이면 30분 칸 4개가 연달아 필요해요.
   - 모든 날짜, 모든 시작 시간마다 "4칸 전부 가능한 사람"을 세요.
   - 사람 수가 많은 순으로 정렬하고, 같으면 더 이른 날짜·시간이 먼저.
   - 같은 날 시간이 겹치는 후보(19:00~21:00 과 19:30~21:30)는 하나만 골라요.
   ========================================================= */

function findBestTimes(howMany) {
  const need = meeting.duration / 30;   // 필요한 칸 수
  const timeList = getTimeList(meeting);
  const candidates = [];

  meeting.dates.forEach(function (date) {
    for (let i = 0; i + need <= timeList.length; i++) {
      const slots = timeList.slice(i, i + need).map(function (time) {
        return makeSlotKey(date, time);
      });
      // 이 칸들을 "전부" 고른 사람만
      const people = responses
        .filter(function (r) {
          return slots.every(function (slot) { return r.slots.includes(slot); });
        })
        .map(function (r) { return r.name; });

      candidates.push({ date: date, index: i, start: timeList[i], people: people });
    }
  });

  // 사람 많은 순. (sort 는 같은 값끼리 원래 순서를 지켜 줘서, 이른 시간이 앞에 남아요)
  candidates.sort(function (a, b) {
    return b.people.length - a.people.length;
  });

  const picked = [];
  for (const candidate of candidates) {
    if (candidate.people.length === 0) break;   // 0명인 후보는 추천하지 않음
    const overlaps = picked.some(function (p) {
      return p.date === candidate.date && Math.abs(p.index - candidate.index) < need;
    });
    if (!overlaps) picked.push(candidate);
    if (picked.length === howMany) break;
  }
  return picked;
}

function renderTopList() {
  const topList = document.getElementById("top-list");
  topList.innerHTML = "";

  if (responses.length === 0) {
    topList.appendChild(makeEmpty("아직 응답이 없어요. 응답 링크를 공유해 보세요!"));
    return;
  }
  const best = findBestTimes(3);
  if (best.length === 0) {
    topList.appendChild(makeEmpty("모임 시간(" + formatDuration(meeting.duration) + ") 동안 함께 되는 시간이 아직 없어요."));
    return;
  }

  const allNames = responses.map(function (r) { return r.name; });

  best.forEach(function (item, index) {
    const isConfirmed = Boolean(meeting.confirmed) &&
      meeting.confirmed.date === item.date && meeting.confirmed.start === item.start;

    const card = document.createElement("article");
    card.className = "top-card";
    if (index === 0) card.classList.add("best");
    if (isConfirmed) card.classList.add("confirmed");

    // 머리: [순위] 10/29(목) 19:00~21:00
    const head = document.createElement("div");
    head.className = "top-card-head";
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = index + 1;
    const when = document.createElement("span");
    when.className = "top-when";
    when.textContent = formatTimeRange(item.date, item.start, meeting.duration);
    head.append(rank, when);
    if (isConfirmed) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "확정";
      head.appendChild(tag);
    }

    // 내용: 8명 가능 · 불참: 김OO, 이OO
    const absent = allNames.filter(function (name) { return !item.people.includes(name); });
    const meta = document.createElement("p");
    meta.className = "top-meta";
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = item.people.length + "명 가능";
    meta.appendChild(count);
    meta.append(absent.length > 0 ? " · 불참: " + absent.join(", ") : " · 모두 가능해요 🎉");

    card.append(head, meta);

    // 주최자에게만 확정 버튼
    if (isHost) {
      card.appendChild(makeConfirmButton(item, index, isConfirmed));
    }
    topList.appendChild(card);
  });
}

function makeConfirmButton(item, index, isConfirmed) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-small";
  if (index !== 0 || isConfirmed) button.classList.add("btn-outline");
  button.textContent = isConfirmed ? "확정 취소" : "이 시간으로 확정";

  button.addEventListener("click", async function () {
    const label = formatTimeRange(item.date, item.start, meeting.duration);
    const question = isConfirmed ? "확정을 취소할까요?" : label + " 으로 확정할까요?";
    if (!confirm(question)) return;

    button.disabled = true;
    try {
      await confirmTime(meetingId, isConfirmed ? null : { date: item.date, start: item.start });
      showToast(isConfirmed ? "확정을 취소했어요." : "시간을 확정했어요!");
      // 화면은 watchMeeting 이 바뀐 값을 받아서 자동으로 다시 그려요
    } catch (error) {
      console.error(error);
      showToast("저장하지 못했어요. 다시 시도해 주세요.");
      button.disabled = false;
    }
  });
  return button;
}

function makeEmpty(message) {
  const box = document.createElement("div");
  box.className = "empty";
  box.textContent = message;
  return box;
}


/* =========================================================
   3. 히트맵
   [시간 글자] + 날짜 수만큼 칸 → 격자. 가능 인원이 많을수록 진한 초록(lv0~lv5)
   ========================================================= */

function renderHeatmap() {
  const heatmap = document.getElementById("heatmap");
  const total = responses.length;
  const namesBySlot = getNamesBySlot();

  heatmap.innerHTML = "";
  // 날짜 수가 모임마다 달라서, 칸 개수를 JS 에서 정해 줘요
  heatmap.style.gridTemplateColumns = "40px repeat(" + meeting.dates.length + ", minmax(34px, 1fr))";

  // (1) 첫 줄: 왼쪽 빈칸 + 날짜 머리글
  heatmap.appendChild(document.createElement("div"));
  meeting.dates.forEach(function (date) {
    const head = document.createElement("div");
    head.className = "hm-head";
    head.textContent = getDayName(date) + "\n" + formatMonthDay(date);   // \n = 줄바꿈
    heatmap.appendChild(head);
  });

  // (2) 30분마다 한 줄: [시간 글자] + 날짜별 칸
  getTimeList(meeting).forEach(function (time) {
    const label = document.createElement("div");
    label.className = "hm-time";
    label.textContent = time.endsWith(":00") ? time : "";   // 정각 줄에만 글자
    heatmap.appendChild(label);

    meeting.dates.forEach(function (date) {
      const names = namesBySlot[makeSlotKey(date, time)] || [];
      // 인원 → 0~5 단계. 예) 12명 중 10명 → 10/12×5 = 4.1 → 올림 5
      const level = total === 0 ? 0 : Math.ceil((names.length / total) * 5);

      const cell = document.createElement("div");
      cell.className = "hm-cell lv" + level;
      cell.title = formatDate(date) + " " + time + " · " + names.length + "명 가능" +
        (names.length > 0 ? "\n" + names.join(", ") : "");
      heatmap.appendChild(cell);
    });
  });

  document.getElementById("legend-max").textContent = total + "명";
}


/* =========================================================
   4. 응답 현황
   ========================================================= */

function renderStatus() {
  // 가나다순 정렬
  const doneNames = responses
    .map(function (r) { return r.name; })
    .sort(function (a, b) { return a.localeCompare(b, "ko"); });

  document.getElementById("stat-done").textContent = doneNames.length + "명";
  fillNameChips(document.getElementById("done-names"), doneNames, "", "아직 없어요");

  // 참여자 명단이 있는 모임만 미응답자 표시
  const members = meeting.members || [];
  const hasMembers = members.length > 0;
  document.getElementById("stat-pending-box").hidden = !hasMembers;
  document.getElementById("pending-section").hidden = !hasMembers;
  document.getElementById("stats").classList.toggle("single", !hasMembers);

  if (hasMembers) {
    const pending = members.filter(function (m) { return !doneNames.includes(m); });
    document.getElementById("stat-pending").textContent = pending.length + "명";
    fillNameChips(document.getElementById("pending-names"), pending, "pending", "모두 응답했어요 🎉");
  }
}

// 이름 칩 채우기. 이름이 없으면 emptyText 를 보여 줌
function fillNameChips(container, names, extraClass, emptyText) {
  container.innerHTML = "";
  if (names.length === 0) {
    const empty = document.createElement("span");
    empty.className = "hint";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  names.forEach(function (name) {
    const chip = document.createElement("span");
    chip.className = "name-chip " + extraClass;
    chip.textContent = name;   // textContent 를 써서 이름에 HTML 이 들어와도 안전해요
    container.appendChild(chip);
  });
}
