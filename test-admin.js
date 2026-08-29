const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
admin.initializeApp({ projectId: "gen-lang-client-0646086635" });
const db = getFirestore(admin.app(), "ai-studio-veronicaai-45824abd-60e2-453d-94f0-f3af993ba70f");
console.log(db.collection('test').path);
