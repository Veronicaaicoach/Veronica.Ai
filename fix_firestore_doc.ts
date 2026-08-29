import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

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

async function fix() {
  try {
    const cred = await signInWithEmailAndPassword(auth, "veronica.ai.coach@gmail.com", "veronica.123");
    
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: cred.user.email,
        subscriptionPlan: 'free',
        createdAt: new Date().toISOString()
      });
      console.log("Created missing Firestore document.");
    } else {
      console.log("Firestore document exists.");
    }
    process.exit(0);
  } catch (err: any) {
    console.error("Error:", err);
    process.exit(1);
  }
}

fix();
