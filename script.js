//최종?!?

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


//////////////////////////////////////////////////////////////////////
const center = document.getElementById("center");
const originalCenterContent = center.innerHTML;
/////////////////////////////////////////////////////////////////////

// 로그인 상태 확인 및 즐겨찾기 로드
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("사용자가 로그인했습니다:", user);
    await loadFavorites();
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
    icon.src = "https://img.icons8.com/ios/15/000000/star--v1.png";
    favoriteQuestions.delete(questionId);
  } else {
    await addDoc(favRef, {
      userId: auth.currentUser.uid,
      questionId,
      addedAt: serverTimestamp()
    });
    icon.src = "https://img.icons8.com/fluency/15/000000/star.png";
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
    ? "https://img.icons8.com/fluency/15/000000/star.png"
    : "https://img.icons8.com/ios/15/000000/star--v1.png";
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
function selectQuestion(question, smallCategory) {
  // center에 dashboard iframe이 있을 경우, 원래 콘텐츠로 복원
  if (document.querySelector("#center iframe")) {
    center.innerHTML = originalCenterContent;
  }

  currentQuestionNumber = question.문항번호;
  correctAnswer = question.정답;
  solutionLink = question.해설주소;
  questionDifficulty = question.난이도;
  // (이미 저장되어 있다면 currentMiddleCategory와 currentSmallCategory도 업데이트)
    currentMiddleCategory = question.중분류 || ""; // 중분류 저장
  currentSmallCategory = smallCategory;         // 소분류 저장
  
  document.getElementById("selectedImage").src = question.문항주소;
  document.getElementById("selectedImage").style.display = "block";
  document.getElementById("questionOverlay").style.display = "flex";
  document.getElementById("questionTitle").innerText = `${smallCategory} - ${question.문항번호}`;
  document.getElementById("result").innerHTML = "";
  document.getElementById("solutionLink").innerHTML = "";

  addFavoriteIcon(document.getElementById("questionTitle"), question.문항번호);
  updateQuestionMeta(question.문항번호);
  updateOverlayLayout();

  document.getElementById("answer").focus();
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
  solutionDiv.innerHTML = isCorrect ? "" : `해설 영상을 보세요: <a href='${solutionLink}' target='_blank'>해설 영상</a>`;

  await storeSubmission(currentQuestionNumber, userAnswer, isCorrect);
  await updateQuestionMeta(currentQuestionNumber);
  document.getElementById("answer").focus();
}

async function storeSubmission(questionId, userAnswer, isCorrect) {
  try {
    await addDoc(collection(db, "answers"), {
      questionId,
      userAnswer,
      isCorrect,
      submittedAt: serverTimestamp(),
      userId: auth.currentUser?.uid || null,
      중분류: currentMiddleCategory,  // 추가
      소분류: currentSmallCategory       // 추가
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
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const dashboardLi = document.createElement("li");
dashboardLi.classList.add("dashboard-menu");

// 아이콘을 추가할 경우, 아래와 같이 이미지 태그를 사용합니다.
dashboardLi.innerHTML = `<img src="https://img.icons8.com/fluency/20/000000/dashboard-layout.png" alt="대시보드 아이콘">
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
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    // 소분류(small)와 중분류(sub) 정보를 모두 전달
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

// 메뉴 토글 (모바일 대응 포함)
function toggleMenu() {
  const left = document.getElementById("left");
  const center = document.getElementById("center");
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


function showDashboard() {
  center.innerHTML = `<iframe src="dashboard.html" style="width:100%; height:100%; border:none;"></iframe>`;
}


// 오버레이 위치 조정
function updateOverlayLayout() {
  const overlay = document.getElementById("questionOverlay");
  overlay.classList.toggle("menu-closed", !menuVisible);
}

// 화면 회전 안내
function checkOrientation() {
  const msg = document.getElementById("rotateMessage");
  msg.style.display = window.innerHeight > window.innerWidth ? "flex" : "none";
}
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
