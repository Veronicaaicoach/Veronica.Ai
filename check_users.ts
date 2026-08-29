import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0646086635",
  appId: "1:994233542906:web:d55f91cf030c31be440143",
  apiKey: "AIzaSyDZw1j0Pe-FV9YChUcYpPX5NEwEvppT_tQ",
  authDomain: "gen-lang-client-0646086635.firebaseapp.com",
  storageBucket: "gen-lang-client-0646086635.firebasestorage.app",
  messagingSenderId: "994233542906",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-veronicaai-45824abd-60e2-453d-94f0-f3af993ba70f");

async function check() {
  const snapshot = await getDocs(collection(db, 'users'));
  snapshot.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
  process.exit(0);
}

check();
