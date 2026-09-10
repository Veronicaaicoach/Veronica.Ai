const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');

const target = `          if (parsed.close) {
             try {
               // STRICT CHECK: Feedback is only generated if premium version is unlocked!
               if (!isPremium) {`;

const replacement = `          if (parsed.close) {
             try {
               if (parsed.isPremium !== undefined) {
                 isPremium = parsed.isPremium;
               }
               // STRICT CHECK: Feedback is only generated if premium version is unlocked!
               if (!isPremium) {`;

if (code.includes(target)) {
  fs.writeFileSync('server.ts', code.replace(target, replacement));
  console.log("Success");
} else {
  console.log("Target not found");
}
