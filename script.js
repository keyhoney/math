//최종

// Firebase 및 Firestore 관련 모듈 import
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, query, where, orderBy, limit, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase 초기화
const firebaseConfig = {
  apiKey: "AIzaSyAppDGlVLrSkUKIioS8FADsJ2KyNB5OcFw",
  authDomain: "gaesaegi-math.firebaseapp.com",
  projectId: "gaesaegi-math",
  storageBucket: "gaesaegi-math.appspot.com",
  messagingSenderId: "211273803590",
  appId: "1:211273803590:web:1d5eea23c7a88fdbf6e747",
  measurementId: "G-QRVNX8KX2N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 전역 변수
let correctAnswer = "";
let solutionLink = "";
let currentQuestionNumber = "";
let questionDifficulty = "";
let currentMiddleCategory = "";
let currentSmallCategory = "";
let favoriteQuestions = new Set();
let menuVisible = window.innerWidth > 600 ? true : false;

// 노트 토글 관련 변수
let noteOpen = false;

// center 관련 요소 참조
const center = document.getElementById("center");
const centerMain = document.getElementById("centerMain");
const questionContent = document.getElementById("questionContent");

//////////////////////////////////////////////////////////////////////
const originalCenterContent = center.innerHTML;
/////////////////////////////////////////////////////////////////////

// 로그인 상태 확인 및 즐겨찾기 로드
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log("User Data:", userData);
      if (!userData.grade || !userData.class || !userData.number || !userData.name) {
        alert("사용자 정보를 입력해야 합니다.");
        window.location.href = "newbie.html";
      } else {
        await loadFavorites(); 
      }
    } else {
      alert("사용자 정보를 입력해야 합니다.");
      window.location.href = "newbie.html";
    }
  } else {
    alert("로그인해 주세요.");
    window.location.href = "index.html";
  }
});

// 즐겨찾기 로드
async function loadFavorites() {
  if (!auth.currentUser) return;
  const q = query(collection(db, "favorites"), where("userId", "==", auth.currentUser.uid));
  const snap = await getDocs(q);
  snap.forEach(doc => favoriteQuestions.add(doc.data().questionId));
  updateFavoriteMarkers();
}

// 즐겨찾기 토글
async function toggleFavorite(questionId, icon) {
  if (!auth.currentUser) return;
  const favRef = collection(db, "favorites");
  const q = query(favRef, where("userId", "==", auth.currentUser.uid), where("questionId", "==", questionId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    await deleteDoc(snap.docs[0].ref);
    icon.src = "img/fvn.png";
    favoriteQuestions.delete(questionId);
  } else {
    await addDoc(favRef, {
      userId: auth.currentUser.uid,
      questionId,
      addedAt: serverTimestamp()
    });
    icon.src = "img/fvy.png";
    favoriteQuestions.add(questionId);
  }

  updateFavoriteMarkers();
}

// 즐겨찾기 UI 업데이트
function updateFavoriteMarkers() {
  document.querySelectorAll("#questionList li").forEach(li => {
    const id = li.getAttribute("data-question-id");
    if (favoriteQuestions.has(id)) {
      li.style.fontWeight = "bold";
      li.style.color = "#f39c12";
    } else {
      li.style.fontWeight = "normal";
      li.style.color = "";
    }
  });
}

// 즐겨찾기 아이콘 생성
function addFavoriteIcon(targetElement, questionId) {
  let oldIcon = targetElement.querySelector(".favorite-icon");
  if (oldIcon) oldIcon.remove();

  const icon = document.createElement("img");
  icon.className = "favorite-icon";
  icon.src = favoriteQuestions.has(questionId)
    ? "img/fvy.png"
    : "img/fvn.png";
  icon.style.marginLeft = "8px";
  icon.style.cursor = "pointer";
  icon.title = "즐겨찾기 토글";

  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite(questionId, icon);
  });

  targetElement.appendChild(icon);
}

// 문항 선택 시 동작
function selectQuestion(question, smallCategory, middleCategory) {
  if (document.querySelector("#center iframe")) {
    center.innerHTML = originalCenterContent;
  }

  console.log("중분류:", middleCategory);
  
  currentQuestionNumber = question.문항번호;
  correctAnswer = question.정답;
  solutionLink = question.해설주소;
  questionDifficulty = question.난이도;
  currentMiddleCategory = middleCategory || "";
  currentSmallCategory = smallCategory;
  
  document.getElementById("selectedImage").src = question.문항주소;
  document.getElementById("selectedImage").style.display = "block";
  document.getElementById("questionOverlay").style.display = "flex";
  document.getElementById("questionTitle").innerText = `${smallCategory} - ${question.문항번호}`;
  document.getElementById("result").innerHTML = "";
  document.getElementById("solutionLink").innerHTML = "";

  addFavoriteIcon(document.getElementById("questionTitle"), question.문항번호);
  updateQuestionMeta(question.문항번호);
  updateOverlayLayout();
}

// 문항 메타 정보 업데이트
async function updateQuestionMeta(questionId) {
  const metaDiv = document.getElementById("questionMeta");
  let metaHTML = `난이도: ${questionDifficulty}, `;
  const q = query(collection(db, "answers"), where("userId", "==", auth.currentUser?.uid || ""), where("questionId", "==", questionId));

  try {
    const snap = await getDocs(q);
    let total = 0, wrong = 0, latest = null;

    snap.forEach(doc => {
      const data = doc.data();
      total++;
      if (!data.isCorrect) wrong++;
      if (!latest || data.submittedAt?.toMillis() > latest.submittedAt?.toMillis()) latest = data;
    });

    metaHTML += `제출 횟수: ${total}, 오답 횟수: ${wrong}`;
    if (latest) {
      const date = latest.submittedAt?.toDate().toLocaleString("ko-KR", { hour12: false }) || "-";
      metaHTML += `<br>최근 제출: ${date} / ${latest.isCorrect ? "정답" : "오답"} (내 답: ${latest.userAnswer || "-"})`;
    }
  } catch (err) {
    console.error("제출 정보 조회 실패:", err);
    metaHTML += "제출 정보를 불러올 수 없습니다.";
  }

  metaDiv.innerHTML = metaHTML;
}

// 답안 제출
async function checkAnswer() {
  if (!currentQuestionNumber || !correctAnswer) {
    alert("먼저 문제를 선택해 주세요.");
    return;
  }

  const userAnswer = document.getElementById("answer").value.trim();
  document.getElementById("answer").value = "";
  const resultDiv = document.getElementById("result");
  const solutionDiv = document.getElementById("solutionLink");
  const isCorrect = userAnswer === correctAnswer;

  resultDiv.innerHTML = isCorrect ? "정답입니다!" : `오답입니다. 정답은 ${correctAnswer}입니다.`;
  solutionDiv.innerHTML = isCorrect ? `필요하면 보세요: <a href='${solutionLink}' target='_blank'>해설 영상</a>` : `해설 영상을 보세요: <a href='${solutionLink}' target='_blank'>해설 영상</a>`;

  await storeSubmission(currentQuestionNumber, userAnswer, isCorrect);
  await updateQuestionMeta(currentQuestionNumber);
}

async function storeSubmission(questionId, userAnswer, isCorrect) {
  try {
    await addDoc(collection(db, "answers"), {
      questionId,
      userAnswer,
      isCorrect,
      submittedAt: serverTimestamp(),
      userId: auth.currentUser?.uid || null,
      중분류: currentMiddleCategory,
      소분류: currentSmallCategory
    });
  } catch (err) {
    console.error("답안 저장 실패:", err);
  }
}

// 메뉴 트리 생성
function createCollapsibleItem(text) {
  const li = document.createElement("li");
  li.textContent = text;
  li.classList.add("collapsible");
  li.addEventListener("click", function(e) {
    const childUl = this.querySelector(":scope > ul");
    if (childUl) {
      childUl.style.display = childUl.style.display === "block" ? "none" : "block";
      this.classList.toggle("open");
    }
    e.stopPropagation();
  });
  return li;
}

// 메뉴 생성 및 문항 렌더링
function generateMenu(questions) {
  const grouped = {};

  const feedbackLi = document.createElement("li");
  feedbackLi.classList.add("dashboard-menu");
  feedbackLi.innerHTML = `<img src="img/feedback.png" alt="피드백 아이콘" style="width:20px; height:auto; vertical-align:middle; margin-right:8px;">
                          오류 제보 및 피드백`;
  feedbackLi.addEventListener("click", (e) => {
    showFeedback();
    if (window.innerWidth <= 600) {
      document.getElementById("left").style.display = "none";
      menuVisible = false;
    }
    e.stopPropagation();
  });
  questionList.prepend(feedbackLi);

  const reviewLi = document.createElement("li");
  reviewLi.classList.add("dashboard-menu");
  reviewLi.innerHTML = `<img src="img/fv.png" alt="즐겨찾기 아이콘" style="width:20px; height:auto; vertical-align:middle; margin-right:8px;">
                        다시 살펴볼 문항`;
  reviewLi.addEventListener("click", (e) => {
    showFavorites();
    if (window.innerWidth <= 600) {
      document.getElementById("left").style.display = "none";
      menuVisible = false;
    }
    e.stopPropagation();
  });
  questionList.prepend(reviewLi);

  const dashboardLi = document.createElement("li");
  dashboardLi.classList.add("dashboard-menu");
  dashboardLi.innerHTML = `<img src="img/ds.png" alt="대시보드 아이콘" style="width:20px; height:auto; vertical-align:middle; margin-right:8px;">
                             대시보드`;
  dashboardLi.addEventListener("click", (e) => {
    showDashboard();
    if (window.innerWidth <= 600) {
      document.getElementById("left").style.display = "none";
      menuVisible = false;
    }
    e.stopPropagation();
  });
  questionList.prepend(dashboardLi);

  const infoiLi = document.createElement("li");
  infoiLi.classList.add("dashboard-menu");
  infoiLi.innerHTML = `<img src="img/info.png" alt="정보 아이콘" style="width:20px; height:auto; vertical-align:middle; margin-right:8px;">
                       웹 이용 방법 안내`;
  infoiLi.addEventListener("click", (e) => {
    showInfoi();
    if (window.innerWidth <= 600) {
      document.getElementById("left").style.display = "none";
      menuVisible = false;
    }
    e.stopPropagation();
  });
  questionList.prepend(infoiLi);

  questions.forEach(item => {
    const { 과목, 대분류, 중분류, 소분류, 문항들 } = item;
    grouped[과목] ??= {};
    grouped[과목][대분류] ??= {};
    grouped[과목][대분류][중분류] ??= {};
    grouped[과목][대분류][중분류][소분류] ??= [];
    grouped[과목][대분류][중분류][소분류].push(...문항들);
  });

  for (const subject in grouped) {
    const subjectLi = createCollapsibleItem(subject);
    const subjectUl = document.createElement("ul");
    subjectUl.style.display = "none";
    subjectLi.appendChild(subjectUl);
    questionList.appendChild(subjectLi);

    for (const cat in grouped[subject]) {
      const catLi = createCollapsibleItem(cat);
      const catUl = document.createElement("ul");
      catUl.style.display = "none";
      catLi.appendChild(catUl);
      subjectUl.appendChild(catLi);

      for (const sub in grouped[subject][cat]) {
        const subLi = createCollapsibleItem(sub);
        const subUl = document.createElement("ul");
        subUl.style.display = "none";
        subLi.appendChild(subUl);
        catUl.appendChild(subLi);

        for (const small in grouped[subject][cat][sub]) {
          const smallLi = createCollapsibleItem(small);
          const smallUl = document.createElement("ul");
          smallUl.style.display = "none";
          smallLi.appendChild(smallUl);
          subUl.appendChild(smallLi);

          grouped[subject][cat][sub][small].forEach(q => {
            const qLi = document.createElement("li");
            qLi.textContent = q.문항번호;
            qLi.setAttribute("data-question-id", q.문항번호);
            qLi.addEventListener("click", function(e) {
              selectQuestion(q, small, sub);
              if (window.innerWidth <= 600) {
                document.getElementById("left").style.display = "none";
                menuVisible = false;
              }
              e.stopPropagation();
            });
            smallUl.appendChild(qLi);
          });
        }
      }
    }
  }
}

// 메뉴 토글 (모바일 대응)
function toggleMenu() {
  const left = document.getElementById("left");
  if (window.innerWidth <= 600) {
    menuVisible = !menuVisible;
    left.style.display = menuVisible ? "block" : "none";
    if (menuVisible) {
      Object.assign(left.style, {
        position: "fixed", top: "0", left: "0", width: "100%",
        height: "100%", padding: "20px", zIndex: "9998"
      });
    }
  } else {
    menuVisible = !menuVisible;
    left.style.width = menuVisible ? "50%" : "0";
    left.style.padding = menuVisible ? "20px" : "0";
    center.style.width = menuVisible ? "50%" : "100%";
  }
  updateOverlayLayout();
}

// 노트 토글 함수
// centerMain 영역에 영향 없이, 별도의 #right 영역을 생성/제거합니다.
function toggleNote() {
  const noteToggleButton = document.getElementById("noteToggleButton");
  const left = document.getElementById("left");

  if (!noteOpen) {
    noteOpen = true;
    noteToggleButton.innerText = "노트 닫기";
    left.style.display = "none";

    // centerMain을 flex로 변경하여 좌측(questionContent)와 우측(note) 영역으로 분할
    centerMain.style.display = "flex";
    // 좌측 영역: 질문 콘텐츠 (너비 40%)
    questionContent.style.width = "40%";

    // 우측 영역: 노트를 담을 div (#right) (너비 60%, 높이는 centerMain 전체 높이)
    let noteDiv = document.createElement("div");
    noteDiv.id = "right";
    noteDiv.style.width = "60%";
    noteDiv.style.height = "100%";
    noteDiv.innerHTML = `<iframe src="note.html" style="width:100%; height:100%; border:none;"></iframe>`;
    centerMain.appendChild(noteDiv);
  } else {
    noteOpen = false;
    noteToggleButton.innerText = "노트 열기";
    left.style.display = "block";
    
    // 노트 영역 제거
    const noteDiv = document.getElementById("right");
    if (noteDiv) noteDiv.remove();
    
    // centerMain 레이아웃을 원래대로 (질문 콘텐츠가 100% 폭)
    centerMain.style.display = "block";
    questionContent.style.width = "100%";
  }
}

function showFeedback() {
  center.innerHTML = `<iframe src="feedback.html" style="width:100%; height:100%; border:none;"></iframe>`;
}

function showFavorites() {
  center.innerHTML = `<iframe src="favorite.html" style="width:100%; height:100%; border:none;"></iframe>`;
}

function showDashboard() {
  center.innerHTML = `<iframe src="dashboard.html" style="width:100%; height:100%; border:none;"></iframe>`;
}

function showInfoi() {
  center.innerHTML = `<iframe src="infoi.html" style="width:100%; height:100%; border:none;"></iframe>`;
}

// 오버레이 위치 조정
function updateOverlayLayout() {
  const overlay = document.getElementById("questionOverlay");
  overlay.classList.toggle("menu-closed", !menuVisible);
}

// 화면 회전 안내
//function checkOrientation() {
  //const msg = document.getElementById("rotateMessage");
  //msg.style.display = window.innerHeight > window.innerWidth ? "flex" : "none";
//}
window.addEventListener("resize", checkOrientation);
window.addEventListener("orientationchange", checkOrientation);
checkOrientation();

// JSON 문항 불러오기
fetch('questions.json')
  .then(res => res.ok ? res.json() : Promise.reject("문항 로딩 실패"))
  .then(data => generateMenu(data))
  .catch(err => console.error("문항 로딩 에러:", err));

// 전역 함수 등록
window.checkAnswer = checkAnswer;
window.toggleMenu = toggleMenu;
window.toggleNote = toggleNote;

// 엔터키로 정답 제출
window.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("answer");
  if (input) {
    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        checkAnswer();
      }
    });
  }
});
