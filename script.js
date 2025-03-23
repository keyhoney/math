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

let favoriteQuestions = new Set();

// 즐겨찾기 목록을 로드
async function loadFavorites() {
  if (!auth.currentUser) return;
  const q = query(collection(db, "favorites"), where("userId", "==", auth.currentUser.uid));
  const snap = await getDocs(q);
  snap.forEach(doc => favoriteQuestions.add(doc.data().questionId));
  updateFavoriteMarkers(); // 즐겨찾기 상태 반영
}

// 즐겨찾기 토글
async function toggleFavorite(questionId, icon) {
  if (!auth.currentUser) return;
  const favRef = collection(db, "favorites");
  const q = query(favRef, where("userId", "==", auth.currentUser.uid), where("questionId", "==", questionId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    // 즐겨찾기에서 삭제
    await deleteDoc(snap.docs[0].ref);
    icon.src = "https://img.icons8.com/ios/24/000000/star--v1.png"; // 별 비우기
    favoriteQuestions.delete(questionId);
  } else {
    // 즐겨찾기 추가
    await addDoc(favRef, {
      userId: auth.currentUser.uid,
      questionId: questionId,
      addedAt: serverTimestamp()
    });
    icon.src = "https://img.icons8.com/fluency/24/000000/star.png"; // 별 채우기
    favoriteQuestions.add(questionId);
  }

  updateFavoriteMarkers();
}

// 즐겨찾기 표시 업데이트
function updateFavoriteMarkers() {
  document.querySelectorAll("#questionList li").forEach(li => {
    const id = li.getAttribute("data-question-id");
    if (favoriteQuestions.has(id)) {
      li.style.fontWeight = "bold";
      li.style.color = "#f39c12"; // 즐겨찾기 색상
    } else {
      li.style.fontWeight = "normal";
      li.style.color = "";
    }
  });
}

// 문항 제목 옆에 즐겨찾기 아이콘 추가
function addFavoriteIcon(targetElement, questionId) {
  let oldIcon = targetElement.querySelector(".favorite-icon");
  if (oldIcon) oldIcon.remove();

  const icon = document.createElement("img");
  icon.className = "favorite-icon";
  icon.src = favoriteQuestions.has(questionId)
    ? "https://img.icons8.com/fluency/24/000000/star.png" // 별 채운 상태
    : "https://img.icons8.com/ios/24/000000/star--v1.png"; // 비어있는 상태
  icon.style.marginLeft = "8px";
  icon.style.cursor = "pointer";
  icon.title = "즐겨찾기 토글";

  icon.addEventListener("click", (e) => {
    e.stopPropagation(); // 클릭 시 다른 이벤트 방지
    toggleFavorite(questionId, icon);
  });

  targetElement.appendChild(icon);
}

// 로그인 후 즐겨찾기 로딩
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("사용자가 로그인했습니다:", user);
    await loadFavorites();
  } else {
    alert("로그인해 주세요.");
    window.location.href = "index.html"; // 로그인 페이지로 리디렉션
  }
});

// 문제 선택 시 즐겨찾기 아이콘 추가
function selectQuestion(question, smallCategory) {
  currentQuestionNumber = question.문항번호;
  correctAnswer = question.정답;
  solutionLink = question.해설주소;
  questionDifficulty = question.난이도;

  document.getElementById("selectedImage").src = question.문항주소;
  document.getElementById("selectedImage").style.display = "block";
  document.getElementById("questionOverlay").style.display = "flex";
  document.getElementById("questionTitle").innerText = `${smallCategory} - ${question.문항번호}`;
  document.getElementById("result").innerHTML = "";
  document.getElementById("solutionLink").innerHTML = "";

  // 즐겨찾기 아이콘 추가
  addFavoriteIcon(document.getElementById("questionTitle"), question.문항번호);
  updateOverlayLayout();
  document.getElementById("answer").focus();
}

// 문항 목록에서 즐겨찾기 표시
function generateMenu(questions) {
  const grouped = {};
  questions.forEach(item => {
    const subject = item.과목;
    const cat = item.대분류;
    const sub = item.중분류;
    const small = item.소분류;
    if (!grouped[subject]) grouped[subject] = {};
    if (!grouped[subject][cat]) grouped[subject][cat] = {};
    if (!grouped[subject][cat][sub]) grouped[subject][cat][sub] = {};
    if (!grouped[subject][cat][sub][small]) grouped[subject][cat][sub][small] = [];
    grouped[subject][cat][sub][small] = grouped[subject][cat][sub][small].concat(item.문항들);
  });

  const questionList = document.getElementById("questionList");
  for (const subject in grouped) {
    const subjectLi = createCollapsibleItem(subject);
    const subjectUl = document.createElement("ul");
    subjectUl.style.display = "none";
    subjectLi.appendChild(subjectUl);
    questionList.appendChild(subjectLi);

    for (const cat in grouped[subject]) {
      const categoryLi = createCollapsibleItem(cat);
      const catUl = document.createElement("ul");
      catUl.style.display = "none";
      categoryLi.appendChild(catUl);
      subjectUl.appendChild(categoryLi);

      for (const sub in grouped[subject][cat]) {
        const subCategoryLi = createCollapsibleItem(sub);
        const subUl = document.createElement("ul");
        subUl.style.display = "none";
        subCategoryLi.appendChild(subUl);
        catUl.appendChild(subCategoryLi);

        for (const small in grouped[subject][cat][sub]) {
          const smallCategoryLi = createCollapsibleItem(small);
          const smallUl = document.createElement("ul");
          smallUl.style.display = "none";
          smallCategoryLi.appendChild(smallUl);
          subUl.appendChild(smallCategoryLi);

          grouped[subject][cat][sub][small].forEach(item => {
            const questionLi = document.createElement("li");
            questionLi.textContent = item.문항번호;
            questionLi.setAttribute("data-question-id", item.문항번호); // 문항 ID 추가
            questionLi.addEventListener("click", function (e) {
              selectQuestion(item, small);
              e.stopPropagation();
            });
            smallUl.appendChild(questionLi);

            // 즐겨찾기 문항 표시
            if (favoriteQuestions.has(item.문항번호)) {
              questionLi.style.fontWeight = "bold";
              questionLi.style.color = "#f39c12";
            }
          });
        }
      }
    }
  }
}

// 질문 클릭 시 즐겨찾기 아이콘 추가
function createCollapsibleItem(text) {
  const li = document.createElement("li");
  li.textContent = text;
  li.classList.add("collapsible");
  li.addEventListener("click", function (e) {
    const childUl = this.querySelector(":scope > ul");
    if (childUl) {
      if (childUl.style.display === "block") {
        childUl.style.display = "none";
        this.classList.remove("open");
      } else {
        childUl.style.display = "block";
        this.classList.add("open");
      }
    }
    e.stopPropagation();
  });
  return li;
}
