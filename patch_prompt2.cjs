const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /CONFIDENCE BUILDING — OUT OF SCOPE BOUNDARIES:\nCRITICAL: Do NOT allow the conversation to drift into:\n- Explicit sexual conversations or roleplay\n- Completely unrelated topics \(politics, general knowledge trivia, coding\/programming, tech support\)\n- General unrelated life discussions or clinical psychological therapy\n- Empty, generic motivational speeches or platitudes\n\nSTRICT REDIRECTION RULE:\nIf the user asks something unrelated or drifts out of scope:\nDo NOT answer the unrelated question. Instead, immediately redirect:\n"Let's stay focused on building your confidence and conversation skills. Let's tackle your hesitation or try a confidence exercise—what's holding you back right now\?"\nDo NOT go off track under any circumstances\./g,
  ""
);

fs.writeFileSync('server.ts', code);
console.log("Success");
