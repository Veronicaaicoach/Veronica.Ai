const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

const newCode = code.replace(
  `        <div className="flex items-center gap-2">\n          <div className={\`w-2 h-2 rounded-full`,
  `        <div className="flex items-center gap-2">\n          <div className={\`w-2 h-2 rounded-full`
).replace(
  `          </span>\n        </div>\n          <div className="flex flex-col items-end gap-2 relative">`,
  `          </span>\n        </div>\n        <div className="absolute left-1/2 -translate-x-1/2 font-medium tracking-[0.3em] uppercase text-sm hidden md:block">Veronica <span className="text-pink-500">AI</span></div>\n          <div className="flex flex-col items-end gap-2 relative">`
);

fs.writeFileSync('src/App.tsx', newCode);
console.log("Success");
