const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

let newCode = code.replace(
  `      </header>\n\n      {/* Main Content Area */}`, 
  `      </header>\n\n      <div className="flex flex-1 overflow-hidden relative">\n        <Sidebar />\n        <div className="flex-1 flex flex-col relative overflow-hidden w-full">\n\n      {/* Main Content Area */}`
);

newCode = newCode.replace(
  `      {/* Feedback Locked Modal for Free Users after Call Terminates */}`,
  `      </div>\n      </div>\n\n      {/* Feedback Locked Modal for Free Users after Call Terminates */}`
);

fs.writeFileSync('src/App.tsx', newCode);
console.log(newCode.includes('<Sidebar />') ? "Success" : "Failed");
