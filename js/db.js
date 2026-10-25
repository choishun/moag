/* =========================================================
   db.js - 데이터 저장/불러오기 담당 (Firebase Firestore)

   다른 파일들은 Firebase 를 직접 만지지 않고, 여기 있는 함수만 불러 써요.
   그래서 나중에 저장 방식을 바꿔도 이 파일만 고치면 됩니다.

   [데이터 구조]
   meetings/{모임아이디}                  ← 모임 정보 1개
     name, dates, startHour, endHour, duration, members, confirmed
     responses/{응답아이디}               ← 그 모임의 응답들
       name, slots, updatedAt
   adminKeys/{관리키}                     ← 주최자 확인용
     meetingId

   ※ 관리 키를 모임 문서에 넣지 않고 따로 둔 이유:
     모임 문서는 응답자도 읽기 때문에, 거기 넣으면 누구나 관리 키를 볼 수 있어요.
   ========================================================= */


/* ---------- Firebase 시작 ---------- */

// 설정값(projectId)이 채워져 있는지 확인
const firebaseReady = Boolean(firebaseConfig.projectId);

let db = null;
if (firebaseReady) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
}

// 각 페이지 시작 때 부름. 설정이 없으면 안내를 띄우고 false
function requireFirebase() {
  if (!firebaseReady) {
    showFatal("Firebase 설정이 아직 없어요. js/firebase-config.js 에 설정값을 붙여 넣어 주세요. (README.md 참고)");
    return false;
  }
  return true;
}

// 주소로 들어온 아이디가 우리가 만든 모양(영어 소문자+숫자)인지 확인
function isValidId(id) {
  return typeof id === "string" && /^[a-z0-9]{6,40}$/.test(id);
}

// 이름 → 응답 문서 아이디. 한글이나 / 같은 글자도 안전하게 바꿔요.
function responseDocId(name) {
  return "n_" + encodeURIComponent(name);
}


/* ---------- 모임 ---------- */

// 새 모임 저장. { id: 모임아이디, key: 관리키 } 를 돌려줌
async function createMeeting(meeting) {
  const id = randomId(8);
  const key = randomId(24);

  // batch = 여러 저장을 "한 번에" 처리 (하나라도 실패하면 둘 다 취소)
  const batch = db.batch();
  batch.set(db.collection("meetings").doc(id), {
    name: meeting.name,
    dates: meeting.dates,
    startHour: meeting.startHour,
    endHour: meeting.endHour,
    duration: meeting.duration,
    members: meeting.members,
    confirmed: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  batch.set(db.collection("adminKeys").doc(key), { meetingId: id });
  await batch.commit();

  return { id: id, key: key };
}

// 모임 정보 한 번 불러오기. 없으면 null
async function getMeeting(id) {
  if (!isValidId(id)) return null;
  const snapshot = await db.collection("meetings").doc(id).get();
  return snapshot.exists ? snapshot.data() : null;
}

// 이 관리 키가 이 모임의 주최자 키가 맞는지
async function isAdmin(meetingId, key) {
  if (!isValidId(meetingId) || !isValidId(key)) return false;
  const snapshot = await db.collection("adminKeys").doc(key).get();
  return snapshot.exists && snapshot.data().meetingId === meetingId;
}

// 모임 정보가 바뀔 때마다 callback 을 불러 줌 (실시간)
function watchMeeting(id, callback) {
  return db.collection("meetings").doc(id).onSnapshot(function (snapshot) {
    if (snapshot.exists) callback(snapshot.data());
  }, function (error) {
    console.error(error);
  });
}

// 시간 확정. confirmed = { date: "2026-10-29", start: "19:00" }, 취소는 null
async function confirmTime(meetingId, confirmed) {
  await db.collection("meetings").doc(meetingId).update({ confirmed: confirmed });
}


/* ---------- 응답 ---------- */

// 응답 저장. 같은 이름이면 덮어써요(= 수정).
async function saveResponse(meetingId, name, slots) {
  await db.collection("meetings").doc(meetingId)
    .collection("responses").doc(responseDocId(name))
    .set({
      name: name,
      slots: slots,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// 이 이름으로 낸 응답 불러오기. 없으면 null
async function getResponse(meetingId, name) {
  const snapshot = await db.collection("meetings").doc(meetingId)
    .collection("responses").doc(responseDocId(name)).get();
  return snapshot.exists ? snapshot.data() : null;
}

// 응답 목록이 바뀔 때마다 callback(응답 배열) 을 불러 줌 (실시간)
function watchResponses(meetingId, callback) {
  return db.collection("meetings").doc(meetingId).collection("responses")
    .onSnapshot(function (querySnapshot) {
      const list = querySnapshot.docs.map(function (doc) {
        return doc.data();
      });
      callback(list);
    }, function (error) {
      console.error(error);
    });
}
