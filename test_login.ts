import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0646086635",
  appId: "1:994233542906:web:d55f91cf030c31be440143",
  apiKey: "AIzaSyDZw1j0Pe-FV9YChUcYpPX5NEwEvppT_tQ",
  authDomain: "gen-lang-client-0646086635.firebaseapp.com",
  storageBucket: "gen-lang-client-0646086635.firebasestorage.app",
  messagingSenderId: "994233542906",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function test() {
  try {
    await signInWithEmailAndPassword(auth, "veronica.ai.coach@gmail.com", "veronica.123");
    console.log("Login successful!");
    process.exit(0);
  } catch (err: any) {
    console.error("Login failed:", err.code);
    process.exit(1);
  }
}

test();
