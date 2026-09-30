const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Insert State
code = code.replace(
  `const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);`,
  `const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);\n  const [showAboutModal, setShowAboutModal] = useState(false);`
);

// Pass prop to Sidebar
code = code.replace(
  `<Sidebar onHowItWorksClick={() => setShowHowItWorksModal(true)} />`,
  `<Sidebar onHowItWorksClick={() => setShowHowItWorksModal(true)} onAboutClick={() => setShowAboutModal(true)} />`
);

// Add modal UI right after the "How It Works" modal
const splitStr = `{/* Feedback Locked Modal for Free Users after Call Terminates */}`;
const aboutUI = `
      {/* About / Philosophy Modal */}
      <AnimatePresence>
        {showAboutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0e0e0e] border border-white/15 rounded-3xl max-w-lg w-full p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setShowAboutModal(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <span className="text-sm font-medium tracking-[0.3em] uppercase">About <span className="text-pink-500">Veronica</span></span>
                <p className="text-xs text-white/50 font-light mt-2">
                  Philosophy & Privacy
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-mono text-sm">✦</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1 tracking-wide">Our Mission</h4>
                    <p className="text-xs text-white/60 leading-relaxed font-light">
                      Social confidence isn't innate; it's a skill built through practice. Veronica AI was created to provide a safe, judgment-free environment where you can practice authentic conversations, refine your social calibration, and build real-world confidence.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-mono text-sm">◈</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1 tracking-wide">Coaching Methodology</h4>
                    <p className="text-xs text-white/60 leading-relaxed font-light">
                      We rely on objective metrics over subjective feelings. By analyzing flow, listening ratio, tone, and engagement, Veronica provides actionable, data-driven feedback designed to iteratively improve your interpersonal dynamics.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-mono text-sm">🔒</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1 tracking-wide">Strict Privacy</h4>
                    <p className="text-xs text-white/60 leading-relaxed font-light">
                      Your practice sessions are private. Voice data is processed securely in real-time to generate coaching feedback and is never permanently stored or used to train public models.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="w-full py-3 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold uppercase tracking-widest transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Feedback Locked Modal for Free Users after Call Terminates */}`;

code = code.replace(splitStr, aboutUI);

fs.writeFileSync('src/App.tsx', code);
console.log("Success");
