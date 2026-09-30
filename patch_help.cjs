const fs = require('fs');

// 1. Patch Sidebar.tsx
let sidebarCode = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebarCode = sidebarCode.replace(
  `export function Sidebar({ onHowItWorksClick, onAboutClick, onContactClick }: { onHowItWorksClick?: () => void, onAboutClick?: () => void, onContactClick?: () => void }) {`,
  `export function Sidebar({ onHowItWorksClick, onAboutClick, onContactClick, onHelpClick }: { onHowItWorksClick?: () => void, onAboutClick?: () => void, onContactClick?: () => void, onHelpClick?: () => void }) {`
);
sidebarCode = sidebarCode.replace(
  `<SidebarItem isExpanded={isExpanded} icon={<HelpCircle className="w-5 h-5" />} label="Help" />`,
  `<SidebarItem isExpanded={isExpanded} icon={<HelpCircle className="w-5 h-5" />} label="Help" onClick={onHelpClick} />`
);
fs.writeFileSync('src/components/Sidebar.tsx', sidebarCode);


// 2. Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// A. Imports (ChevronDown)
if (!appCode.includes('ChevronDown')) {
  appCode = appCode.replace(/import \{([^}]+)\} from 'lucide-react';/, "import {$1, ChevronDown} from 'lucide-react';");
}

// B. State
appCode = appCode.replace(
  `const [contactCopied, setContactCopied] = useState(false);`,
  `const [contactCopied, setContactCopied] = useState(false);\n  const [showHelpModal, setShowHelpModal] = useState(false);\n  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);`
);

// C. Sidebar Props
appCode = appCode.replace(
  `onContactClick={() => setShowContactModal(true)} />`,
  `onContactClick={() => setShowContactModal(true)} onHelpClick={() => setShowHelpModal(true)} />`
);

// D. Modal UI
const splitStr = `{/* Feedback Locked Modal for Free Users after Call Terminates */}`;
const helpModal = `
      {/* Help / FAQ Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0e0e0e] border border-white/15 rounded-3xl max-w-lg w-full p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setShowHelpModal(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <span className="text-sm font-medium tracking-[0.3em] uppercase">Help & <span className="text-pink-500">FAQ</span></span>
                <p className="text-xs text-white/50 font-light mt-2">
                  Frequently Asked Questions
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    q: "Why can't Veronica hear me?",
                    a: "Ensure you have granted microphone permissions in your browser. If you denied them previously, click the lock icon in your URL bar to reset permissions, then refresh the page."
                  },
                  {
                    q: "How is my feedback score calculated?",
                    a: "Your score is a composite of 5 key metrics: Flow (pauses/stuttering), Listening Ratio (did you dominate the conversation?), Confidence (vocal tone and strength), Engagement (asking questions back), and Calibration (social appropriateness)."
                  },
                  {
                    q: "Can I practice in other languages?",
                    a: "Currently, Veronica is optimized for English, but the underlying Gemini Multimodal API can understand many languages. For the most accurate coaching and scoring, English is recommended."
                  },
                  {
                    q: "Is my voice data saved?",
                    a: "No. Your voice is streamed directly to generate real-time feedback and is not recorded, saved, or used to train models after your session ends."
                  }
                ].map((faq, index) => (
                  <div key={index} className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="text-sm font-medium text-white/90">{faq.q}</span>
                      <ChevronDown className={\`w-4 h-4 text-white/50 transition-transform duration-300 \${expandedFaq === index ? 'rotate-180' : ''}\`} />
                    </button>
                    <AnimatePresence>
                      {expandedFaq === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 pt-0 text-xs text-white/60 font-light leading-relaxed border-t border-white/10 mt-2">
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <button
                  onClick={() => setShowHelpModal(false)}
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

appCode = appCode.replace(splitStr, helpModal);

fs.writeFileSync('src/App.tsx', appCode);
console.log("Success");
