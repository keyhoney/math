import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAppDGlVLrSkUKIioS8FADsJ2KyNB5OcFw",
  authDomain: "gaesaegi-math.firebaseapp.com",
  projectId: "gaesaegi-math",
  storageBucket: "gaesaegi-math.firebasestorage.app",
  messagingSenderId: "211273803590",
  appId: "1:211273803590:web:1d5eea23c7a88fdbf6e747",
  measurementId: "G-QRVNX8KX2N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("로그인 후 이용해 주세요.");
    location.href = "index.html";
    return;
  }

  const q = query(collection(db, "answers"), where("userId", "==", user.uid));
  const snapshot = await getDocs(q);

  let correct = 0, wrong = 0;
  const submissions = [];
  const dateMap = {};
  const categoryMap = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    const dateStr = data.submittedAt?.toDate().toISOString().slice(0, 10);
    const isCorrect = data.isCorrect;
    const questionId = data.questionId;

    if (isCorrect) correct++; else wrong++;
    submissions.push({ date: dateStr, questionId, isCorrect });

    if (!isCorrect && data.smallCategory) {
      categoryMap[data.smallCategory] = (categoryMap[data.smallCategory] || 0) + 1;
    }

    if (dateStr) {
      dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
    }
  });

  // 전체 정답률 차트
  new Chart(document.getElementById("overallChart"), {
    type: "doughnut",
    data: {
      labels: ["정답", "오답"],
      datasets: [{
        data: [correct, wrong],
        backgroundColor: ["#2ecc71", "#e74c3c"]
      }]
    }
  });

  // 날짜별 제출 추이 (최근 7일)
  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const dailyCounts = last7.map(date => dateMap[date] || 0);

  new Chart(document.getElementById("dailyChart"), {
    type: "bar",
    data: {
      labels: last7,
      datasets: [{
        label: "제출 수",
        data: dailyCounts,
        backgroundColor: "#3498db"
      }]
    }
  });

  // 자주 틀리는 분류 (상위 5개)
  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  new Chart(document.getElementById("wrongCategoryChart"), {
    type: "bar",
    data: {
      labels: topCategories.map(c => c[0]),
      datasets: [{
        label: "오답 수",
        data: topCategories.map(c => c[1]),
        backgroundColor: "#f39c12"
      }]
    }
  });

  // 제출 목록 테이블 렌더링
  const tbody = document.getElementById("submissionTable");
  submissions.sort((a, b) => b.date.localeCompare(a.date));
  submissions.forEach(sub => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${sub.date || "-"}</td>
      <td>${sub.questionId}</td>
      <td style="color:${sub.isCorrect ? '#2ecc71' : '#e74c3c'}">
        ${sub.isCorrect ? '정답' : '오답'}
      </td>
    `;
    tbody.appendChild(tr);
  });
});
