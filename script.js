// Firebase 및 Firestore 관련 모듈 import
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

// 전역 변수들
let correctAnswer = "";
let solutionLink = "";
let currentQuestionNumber = "";
let questionDifficulty = "";
let menuVisible = window.innerWidth > 600 ? true : false;

async function checkAnswer() {
  if (!currentQuestionNumber || !correctAnswer) {
    alert("먼저 문제를 선택해 주세요.");
    return;
  }

  const userAnswer = document.getElementById("answer").value;
  document.getElementById("answer").value = "";
  const resultDiv = document.getElementById("result");
  const solutionDiv = document.getElementById("solutionLink");
  let isCorrect = false;

  if (userAnswer === correctAnswer) {
    resultDiv.innerHTML = "정답입니다!";
    solutionDiv.innerHTML = "";
    isCorrect = true;
  } else {
    resultDiv.innerHTML = "오답입니다. 정답은 " + correctAnswer + "입니다.";
    solutionDiv.innerHTML = `해설 영상을 보세요: <a href='${solutionLink}' target='_blank'>해설 영상</a>`;
  }

  await storeSubmission(currentQuestionNumber, userAnswer, isCorrect);
  await updateQuestionMeta(currentQuestionNumber);

  document.getElementById("answer").focus();
}

async function updateQuestionMeta(questionId) {
  const metaDiv = document.getElementById("questionMeta");
  let metaHTML = `난이도: ${questionDifficulty}, `;

  // 개인별 제출/오답 수 계산
  const answersRef = collection(db, "answers");
  const q = query(
    answersRef,
    where("userId", "==", auth.currentUser?.uid || ""),
    where("questionId", "==", questionId)
  );

  try {
    const querySnap = await getDocs(q);
    let total = 0;
    let wrong = 0;
    let latest = null;

    querySnap.forEach(doc => {
      const data = doc.data();
      total++;
      if (!data.isCorrect) wrong++;
      if (!latest || data.submittedAt?.toMillis() > latest.submittedAt?.toMillis()) {
        latest = data;
      }
    });

    metaHTML += `제출 횟수: ${total}, 오답 횟수: ${wrong}`;

    if (latest) {
      const date = latest.submittedAt?.toDate().toLocaleString("ko-KR", { hour12: false }) || "-";
      const isCorrect = latest.isCorrect;
      const userAnswer = latest.userAnswer || "-";
      const resultText = isCorrect ? "정답" : "오답";
      metaHTML += `<br>최근 제출: ${date} / ${resultText} (내 답: ${userAnswer})`;
    }
  } catch (err) {
    console.error("개인 제출 정보 조회 실패:", err);
    metaHTML += `제출 정보를 불러올 수 없습니다.`;
  }

  metaDiv.innerHTML = metaHTML;
}

function createCollapsibleItem(text) {
  const li = document.createElement("li");
  li.textContent = text;
  li.classList.add("collapsible");
  li.addEventListener("click", function(e) {
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
            questionLi.addEventListener("click", function(e) {
              selectQuestion(item, small);
              if (window.innerWidth <= 600) {
                document.getElementById("left").style.display = "none";
                menuVisible = false;
              }
              updateOverlayLayout();
              e.stopPropagation();
            });
            smallUl.appendChild(questionLi);
          });
        }
      }
    }
  }
}

function toggleMenu() {
  const left = document.getElementById("left");
  const center = document.getElementById("center");
  if (window.innerWidth <= 600) {
    if (menuVisible) {
      left.style.display = "none";
      menuVisible = false;
    } else {
      left.style.display = "block";
      left.style.position = "fixed";
      left.style.top = "0";
      left.style.left = "0";
      left.style.width = "100%";
      left.style.height = "100%";
      left.style.padding = "20px";
      left.style.zIndex = "9998";
      menuVisible = true;
    }
  } else {
    menuVisible = !menuVisible;
    if (menuVisible) {
      left.style.width = "50%";
      left.style.padding = "20px";
      center.style.width = "50%";
    } else {
      left.style.width = "0";
      left.style.padding = "0";
      center.style.width = "100%";
    }
  }
  updateOverlayLayout();
}

function updateOverlayLayout() {
  const overlay = document.getElementById("questionOverlay");
  if (menuVisible) {
    overlay.classList.remove("menu-closed");
  } else {
    overlay.classList.add("menu-closed");
  }
}

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

  updateQuestionMeta(question.문항번호);

  updateOverlayLayout();
  document.getElementById("answer").focus();
}

async function storeSubmission(questionId, userAnswer, isCorrect) {
  try {
    await addDoc(collection(db, "answers"), {
      questionId: questionId,
      userAnswer: userAnswer,
      isCorrect: isCorrect,
      submittedAt: serverTimestamp(),
      userId: auth.currentUser ? auth.currentUser.uid : null
    });
    console.log("답안 제출 정보가 저장되었습니다.");
  } catch (error) {
    console.error("답안 제출 정보 저장 실패: ", error);
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("사용자가 로그인했습니다:", user);
  } else {
    alert("로그인해 주세요.");
    window.location.href = "index.html";
  }
});

function checkOrientation() {
  const rotateMessage = document.getElementById("rotateMessage");
  if (window.innerHeight > window.innerWidth) {
    rotateMessage.style.display = "flex";
  } else {
    rotateMessage.style.display = "none";
  }
}
window.addEventListener("resize", checkOrientation);
window.addEventListener("orientationchange", checkOrientation);
checkOrientation();

fetch('questions.json')
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => { generateMenu(data); })
  .catch(error => console.error('Error loading JSON:', error));

window.checkAnswer = checkAnswer;
window.toggleMenu = toggleMenu;

window.addEventListener("DOMContentLoaded", () => {
  const answerInput = document.getElementById("answer");
  if (answerInput) {
    answerInput.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        checkAnswer();
      }
    });
  }
});
