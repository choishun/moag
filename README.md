# 모아그 (IGRUS 일정 조율)

모아서 그리는 우리들의 만남, 모아그.
주최자가 후보 날짜·시간으로 모임을 만들고 응답 링크를 공유하면, 참여자들이 가능한 시간을 고르고, 결과 화면에서 가장 많이 모일 수 있는 시간을 추천해 줍니다.

순수 HTML / CSS / JavaScript + Firebase Firestore(데이터 저장)로 만들었어요.

---

## 1. Firebase 설정 (처음 한 번)

### ① 프로젝트 만들기
1. https://console.firebase.google.com 접속 → **프로젝트 추가**
2. 이름 입력(예: `moag`) → Google 애널리틱스는 꺼도 돼요 → 만들기

### ② 웹 앱 등록 + 설정값 복사
1. 프로젝트 첫 화면에서 **`</>` (웹)** 아이콘 클릭
2. 앱 닉네임 입력 → **앱 등록** (Firebase 호스팅 체크는 나중에 해도 됨)
3. 화면에 나오는 `const firebaseConfig = { ... }` 안의 값들을
   **`js/firebase-config.js`** 의 빈칸에 그대로 붙여 넣기

### ③ Firestore 데이터베이스 만들기
1. 왼쪽 메뉴 **빌드 → Firestore Database → 데이터베이스 만들기**
2. 위치: **`asia-northeast3 (서울)`** 추천
3. **프로덕션 모드**로 시작
4. 만들어지면 **규칙** 탭 → 이 폴더의 **`firestore.rules`** 내용을 통째로 붙여 넣고 **게시**

---

## 2. 내 컴퓨터에서 실행하기

HTML 파일을 더블클릭해서 열면 일부 기능(클립보드 복사 등)이 막힐 수 있어서, **간단한 로컬 서버**로 여는 걸 추천해요.

**방법 A — VS Code (가장 쉬움)**
1. 확장 프로그램 **Live Server** 설치
2. `index.html` 에서 오른쪽 클릭 → **Open with Live Server**

**방법 B — 파이썬이 있다면**
```
python -m http.server 5500
```
→ 브라우저에서 http://localhost:5500 접속

> ⚠️ 로컬에서 만든 링크(`localhost` 주소)는 **내 컴퓨터에서만** 열려요.
> 친구들 폰에서 열리게 하려면 아래 3번처럼 인터넷에 올려야 해요.

---

## 3. 인터넷에 올리기 (다른 사람과 공유)

**GitHub Pages** (무료, 설치할 것 없음)
1. GitHub 에 이 폴더를 올리기 (`git push`)
2. 저장소 → **Settings → Pages**
3. Source: **Deploy from a branch**, Branch: **main** / **/(root)** → Save
4. 1~2분 뒤 `https://아이디.github.io/저장소이름/` 주소가 생겨요.
   코드를 고치고 다시 push 하면 자동으로 반영돼요.

> `js/firebase-config.js` 의 값은 원래 브라우저에 공개되는 값이라 GitHub 에 올려도 괜찮아요.
> 데이터는 `firestore.rules` 보안 규칙이 지켜 줘요.

**Firebase Hosting**
```
npm install -g firebase-tools
firebase login
firebase init hosting      # public 폴더를 물으면 "."  /  single-page app 은 No
firebase deploy
```
→ `https://프로젝트이름.web.app` 주소가 생겨요.

GitHub Pages, Netlify(폴더를 끌어다 놓기만 하면 됨)도 똑같이 쓸 수 있어요.

---

## 4. 파일 구조

```
index.html          모임 만들기
created.html        모임 생성 완료 (응답 링크 + 관리 링크, 주최자 전용)
respond.html        응답 페이지
result.html         결과 페이지 (관리 키가 있으면 주최자 화면)
css/style.css       공통 스타일
js/firebase-config.js  Firebase 설정값 (직접 채우기)
js/utils.js         날짜·시간 등 도우미 함수
js/db.js            데이터 저장/불러오기 (Firebase 를 만지는 유일한 파일)
js/create.js        index.html 동작
js/created.js       created.html 동작
js/respond.js       respond.html 동작
js/result.js        result.html 동작
firestore.rules     Firestore 보안 규칙 (콘솔에 붙여 넣기)
images/             로고, 탭 아이콘
```

---

## 5. 알아 둘 한계

- **로그인이 없어요.** 같은 이름으로 다시 제출하면 그 이름의 응답을 덮어써요. 그래서 다른 사람이 내 이름으로 응답을 바꿀 수도 있어요. 동아리 안에서 쓰는 걸 전제로 했어요.
- **주최자 구분은 "관리 링크를 아는지"로만 해요.** 화면에서는 주최자에게만 확정 버튼이 보이지만, 보안 규칙은 로그인 없이 주최자를 확인할 수 없어서, 기술적으로는 확정 값을 누구나 바꿀 수 있어요. 더 엄격하게 하려면 Firebase Authentication(로그인)을 붙여야 해요.
- **카톡 미리보기 문구는 모든 모임이 같아요.** 미리보기는 서버가 HTML 을 보내는 순간 정해져서, 모임 이름을 넣으려면 서버 쪽 코드가 필요해요.
