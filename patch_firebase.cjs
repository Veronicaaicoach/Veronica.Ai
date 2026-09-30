const fs = require('fs');
let code = fs.readFileSync('src/firebase.ts', 'utf8');

code = code.replace(/import \{ getFirestore \} from 'firebase\/firestore';/, "import { getFirestore, initializeFirestore } from 'firebase/firestore';");
code = code.replace(
  `export const db = getFirestore(app, "ai-studio-veronicaai-45824abd-60e2-453d-94f0-f3af993ba70f");`,
  `export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, "ai-studio-veronicaai-45824abd-60e2-453d-94f0-f3af993ba70f");`
);

fs.writeFileSync('src/firebase.ts', code);
console.log("Success");
