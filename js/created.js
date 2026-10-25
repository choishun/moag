/* =========================================================
   created.js - 모임 생성 완료 화면 (created.html)

   주소에서 모임 아이디(id)와 관리 키(key)를 읽어서
   응답 링크 / 관리 링크를 만들어 보여 줍니다.
   ========================================================= */

const meetingId = getParam("id");
const adminKey = getParam("key");

init();

async function init() {
  if (!requireFirebase()) return;
  if (!meetingId || !adminKey) {
    showFatal("링크가 올바르지 않아요. 모임을 다시 만들어 주세요.");
    return;
  }

  // 모임 정보를 불러와서 요약 상자 채우기
  let meeting = null;
  try {
    meeting = await getMeeting(meetingId);
  } catch (error) {
    console.error(error);
    showFatal("모임 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    return;
  }
  if (!meeting) {
    showFatal("모임을 찾을 수 없어요.");
    return;
  }

  document.getElementById("info-name").textContent = meeting.name;
  document.getElementById("info-detail").textContent = describeMeeting(meeting);

  // new URL(상대주소, 지금주소) = 지금 페이지 기준의 전체 주소를 만들어 줌
  // 예) https://내사이트/respond.html?id=abc
  const respondUrl = new URL("respond.html?id=" + meetingId, location.href).href;
  const adminUrl = new URL("result.html?id=" + meetingId + "&key=" + adminKey, location.href).href;

  document.getElementById("respond-link").value = respondUrl;
  document.getElementById("admin-link").value = adminUrl;
  document.getElementById("open-respond").href = respondUrl;
  document.getElementById("open-result").href = adminUrl;

  // 복사 버튼
  setupCopyButton("copy-respond", respondUrl, "응답 링크를 복사했어요!");
  setupCopyButton("copy-admin", adminUrl, "관리 링크를 복사했어요!");
}

function setupCopyButton(buttonId, text, message) {
  document.getElementById(buttonId).addEventListener("click", async function () {
    const ok = await copyText(text);
    showToast(ok ? message : "복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.");
  });
}
