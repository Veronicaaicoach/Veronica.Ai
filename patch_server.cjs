const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const isConfidenceModule = Boolean\(moduleName && moduleName\.toLowerCase\(\)\.includes\("confidence"\)\);/g,
  `const isApproachModule = Boolean(moduleName && moduleName.toLowerCase().includes("approach"));`
);

code = code.replace(/!isConfidenceModule/g, `!isApproachModule`);
code = code.replace(/isConfidenceModule/g, `isApproachModule`);

code = code.replace(/=== MODULE 4: CONFIDENCE BUILDING ===/g, `=== MODULE 4: APPROACH SKILLS ===`);
code = code.replace(/6\. Confidence Exercises:/g, `6. Approach Exercises:`);
code = code.replace(/7\. Confidence Challenges \(Progressive Levels\):/g, `7. Approach Challenges (Progressive Levels):`);
code = code.replace(/CURRENT ACTIVE MODULE: MODULE 4 — CONFIDENCE BUILDING/g, `CURRENT ACTIVE MODULE: MODULE 4 — APPROACH SKILLS`);

code = code.replace(
  /Evaluate specifically against Module 4 \(Confidence Building\): overcoming hesitation, willingness to start speaking, speaking clarity and asserting opinions, handling silence or awkward moments calmly without over-correcting, and maintaining composure\./g,
  `Evaluate specifically against Module 4 (Approach Skills): overcoming hesitation, building confidence to approach women, starting interactions naturally, speaking clarity, and handling nervousness smoothly.`
);

fs.writeFileSync('server.ts', code);
console.log("Success");
