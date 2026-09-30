const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  '<nav className="bg-[#050505]/80 backdrop-blur-xl border-t border-white/5 absolute bottom-0 w-full z-20 pb-env">',
  '<nav className="bg-[#050505]/80 backdrop-blur-xl border-t border-white/5 shrink-0 relative z-20 pb-env w-full mt-auto">'
);

// We should also change min-h-screen to h-screen or min-h-[100dvh] h-[100dvh] to ensure the root doesn't expand beyond the viewport
code = code.replace(
  '<div className="min-h-screen bg-[#050505]',
  '<div className="h-[100dvh] min-h-[100dvh] bg-[#050505]'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Success");
