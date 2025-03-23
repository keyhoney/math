import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase 초기화
const firebaseConfig = { /* ... */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("로그인해 주세요.");
    location.href = "index.html";
    return;
  }

  const q = query(collection(db, "answers"), where("userId", "==", user.uid));
  const querySnapshot = await getDocs(q);

  let total = 0, correct = 0;
  for (const doc of querySnapshot.docs) {
    const data = doc.data();
    total++;
    if (data.isCorrect) correct++;
  }

  document.getElementById("totalCount").textContent = total;
  document.getElementById("accuracy").textContent = total > 0 ? `${Math.round(correct / total * 100)}%` : "0%";

  // Chart.js 그래프
  const ctx = document.getElementById('chart');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['정답', '오답'],
      datasets: [{
        data: [correct, total - correct],
        backgroundColor: ['#2ecc71', '#e74c3c']
      }]
    }
  });
});
