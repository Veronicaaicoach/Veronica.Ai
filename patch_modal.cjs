const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

// Insert state
let newCode = code.replace(
  `const [showFeedbackLockedModal, setShowFeedbackLockedModal] = useState(false);`,
  `const [showFeedbackLockedModal, setShowFeedbackLockedModal] = useState(false);\n  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);`
);

// Pass prop to Sidebar
newCode = newCode.replace(
  `<Sidebar />`,
  `<Sidebar onHowItWorksClick={() => setShowHowItWorksModal(true)} />`
);

// Add modal UI at the end, right before the {showFeedbackLockedModal ...}
const modalUI = `
      {/* How It Works Modal */}
      <AnimatePresence>
        {showHowItWorksModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0e0e0e] border border-white/15 rounded-3xl max-w-lg w-full p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setShowHowItWorksModal(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <span className="text-sm font-medium tracking-[0.3em] uppercase">How It <span className="text-pink-500">Works</span></span>
                <p className="text-xs text-white/50 font-light mt-2">
                  Veronica AI is your personal, real-time Dating & Social Confidence Coach.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-mono text-sm">01</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1 tracking-wide">Select a Module</h4>
                    <p className="text-xs text-white/60 leading-relaxed font-light">
                      Choose from Practice Conversations, Dating Advice, Flirting Practice, or Confidence Building. Each module has a specific coaching focus.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-mono text-sm">02</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1 tracking-wide">Live Voice Practice</h4>
                    <p className="text-xs text-white/60 leading-relaxed font-light">
                      Tap the microphone to start a live, low-latency voice call powered by Gemini's Multimodal Live API. Speak naturally, as if on a real date or social interaction.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-mono text-sm">03</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1 tracking-wide">Get Objective Feedback</h4>
                    <p className="text-xs text-white/60 leading-relaxed font-light">
                      When you hang up, the system evaluates your actual voice performance across 5 parameters (Flow, Listening, Confidence, Engagement, Calibration) and delivers a scored report with actionable tips.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <button
                  onClick={() => setShowHowItWorksModal(false)}
                  className="w-full py-3 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold uppercase tracking-widest transition-all"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Feedback Locked Modal for Free Users after Call Terminates */}`;

newCode = newCode.replace(
  `{/* Feedback Locked Modal for Free Users after Call Terminates */}`,
  modalUI
);

fs.writeFileSync('src/App.tsx', newCode);
console.log("Success");
