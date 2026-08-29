import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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
const db = getFirestore(app, "ai-studio-veronicaai-45824abd-60e2-453d-94f0-f3af993ba70f");

async function seed() {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, "veronica.ai.coach@gmail.com", "veronica.123");
    const user = userCredential.user;
    
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      subscriptionPlan: 'free',
      createdAt: new Date().toISOString()
    });
    
    console.log("Account created successfully for:", user.email);
    process.exit(0);
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      console.log("Account already exists.");
      process.exit(0);
    }
    console.error("Error:", err);
    process.exit(1);
  }
}

seed();
