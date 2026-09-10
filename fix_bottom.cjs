const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<nav className="bg-\[\#050505\]\/80 backdrop-blur-xl border-t border-white\/5 absolute bottom-0 w-full z-20 pb-env">.*?\{\/\* Feedback Locked Modal for Free Users after Call Terminates \*\/\}/s;

const replacement = `<nav className="bg-[#050505]/80 backdrop-blur-xl border-t border-white/5 absolute bottom-0 w-full z-20 pb-env">
        <div className="flex justify-center items-center gap-2 max-w-md mx-auto p-4 w-full">
          <button 
            onClick={() => setActiveTab('feedback')}
            className={\`flex-1 py-3 rounded-full border text-xs font-medium uppercase tracking-widest transition-all \${
              activeTab === 'feedback' 
                ? 'bg-transparent border-pink-500 text-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]' 
                : 'bg-transparent border-transparent text-white/40 hover:text-white/80'
            }\`}
          >
            Feedback
          </button>
          
          <button 
            onClick={() => setActiveTab('practice')}
            className={\`flex-1 py-3 rounded-full border text-xs font-medium uppercase tracking-widest transition-all \${
              activeTab === 'practice' 
                ? 'bg-transparent border-pink-500 text-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]' 
                : 'bg-transparent border-transparent text-white/40 hover:text-white/80'
            }\`}
          >
            Core
          </button>
          
          <button 
            onClick={() => setActiveTab('pricing')}
            className={\`flex-1 py-3 rounded-full border text-xs font-medium uppercase tracking-widest transition-all \${
              activeTab === 'pricing' 
                ? 'bg-transparent border-pink-500 text-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]' 
                : 'bg-transparent border-transparent text-white/40 hover:text-white/80'
            }\`}
          >
            Pricing
          </button>
        </div>
      </nav>

      </div>
      </div>

      {/* Feedback Locked Modal for Free Users after Call Terminates */}`;

if (code.match(regex)) {
  fs.writeFileSync('src/App.tsx', code.replace(regex, replacement));
  console.log("Success");
} else {
  console.log("Regex not found");
}
