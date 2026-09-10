const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

// Insert import
let newCode = code.replace("import { AuthScreen } from './components/AuthScreen';", "import { AuthScreen } from './components/AuthScreen';\nimport { Sidebar } from './components/Sidebar';");

// Replace layout wrapper
const targetStart = `<div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-pink-500/20 overflow-hidden flex flex-col">`;
const targetEndHeader = `</header>`;

const regex = new RegExp(`(<div className="min-h-screen bg=\\[#050505\\] text-white font-sans selection:bg-pink-500\\/20 overflow-hidden flex flex-col">.*?<\\/header>)`, 's');

newCode = newCode.replace(regex, `$1\n      <div className="flex flex-1 overflow-hidden relative">\n        <Sidebar />\n        <div className="flex-1 flex flex-col relative overflow-hidden w-full">`);

const bottomNavRegex = new RegExp(`(<nav className="bg-\\[#050505\\]\\/80 backdrop-blur-xl border-t border-white\\/5 fixed bottom-0 w-full z-20 pb-env">.*?<\\/nav>)`, 's');
// Wait, bottom nav uses fixed bottom-0 w-full. I should change it to absolute bottom-0 w-full to stay inside the flex-1 area, or adjust the nav styling.
newCode = newCode.replace(bottomNavRegex, `<nav className="bg-[#050505]/80 backdrop-blur-xl border-t border-white/5 absolute bottom-0 w-full z-20 pb-env">\n$1`.replace('<nav className="bg-[#050505]/80 backdrop-blur-xl border-t border-white/5 fixed bottom-0 w-full z-20 pb-env">', '<div className="flex justify-center items-center gap-2 max-w-md mx-auto p-4 w-full">'));
// actually it's easier to just replace the nav class
newCode = newCode.replace('fixed bottom-0 w-full', 'absolute bottom-0 w-full');

// and close the layout divs at the end of the return statement
newCode = newCode.replace('{/* Feedback Locked Modal', '</div>\n      </div>\n\n      {/* Feedback Locked Modal');

fs.writeFileSync('src/App.tsx', newCode);
console.log("Success");
