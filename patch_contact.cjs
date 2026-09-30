const fs = require('fs');

// 1. Patch Sidebar.tsx
let sidebarCode = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebarCode = sidebarCode.replace(
  `export function Sidebar({ onHowItWorksClick, onAboutClick }: { onHowItWorksClick?: () => void, onAboutClick?: () => void }) {`,
  `export function Sidebar({ onHowItWorksClick, onAboutClick, onContactClick }: { onHowItWorksClick?: () => void, onAboutClick?: () => void, onContactClick?: () => void }) {`
);
sidebarCode = sidebarCode.replace(
  `<SidebarItem isExpanded={isExpanded} icon={<Mail className="w-5 h-5" />} label="Contact" />`,
  `<SidebarItem isExpanded={isExpanded} icon={<Mail className="w-5 h-5" />} label="Contact" onClick={onContactClick} />`
);
fs.writeFileSync('src/components/Sidebar.tsx', sidebarCode);


// 2. Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// A. Imports
if (!appCode.includes('Copy,')) {
  appCode = appCode.replace(/import \{([^}]+)\} from 'lucide-react';/, "import {$1, Copy, Check, Mail} from 'lucide-react';");
}

// B. State
appCode = appCode.replace(
  `const [showAboutModal, setShowAboutModal] = useState(false);`,
  `const [showAboutModal, setShowAboutModal] = useState(false);\n  const [showContactModal, setShowContactModal] = useState(false);\n  const [contactCopied, setContactCopied] = useState(false);`
);

// C. Sidebar Props
appCode = appCode.replace(
  `<Sidebar onHowItWorksClick={() => setShowHowItWorksModal(true)} onAboutClick={() => setShowAboutModal(true)} />`,
  `<Sidebar onHowItWorksClick={() => setShowHowItWorksModal(true)} onAboutClick={() => setShowAboutModal(true)} onContactClick={() => setShowContactModal(true)} />`
);

// D. Modal UI
const splitStr = `{/* Feedback Locked Modal for Free Users after Call Terminates */}`;
const contactModal = `
      {/* Contact Modal */}
      <AnimatePresence>
        {showContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0e0e0e] border border-white/15 rounded-3xl max-w-sm w-full p-8 shadow-2xl relative text-center"
            >
              <button 
                onClick={() => { setShowContactModal(false); setContactCopied(false); }}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mx-auto mb-6 text-pink-400">
                <Mail className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-light text-white mb-2 tracking-wide">Get in Touch</h3>
              <p className="text-xs text-white/50 font-light mb-6">
                Have feedback, questions, or just want to say hi? Send us an email anytime.
              </p>

              <div className="flex items-center justify-between bg-black/50 border border-white/10 rounded-xl p-3 mb-8">
                <span className="text-sm font-mono text-white/90 truncate ml-2">
                  veronica.ai.coach@gmail.com
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("veronica.ai.coach@gmail.com");
                    setContactCopied(true);
                    setTimeout(() => setContactCopied(false), 2000);
                  }}
                  className="ml-3 p-2 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors shrink-0 flex items-center justify-center"
                  title="Copy Email"
                >
                  {contactCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => { setShowContactModal(false); setContactCopied(false); }}
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

appCode = appCode.replace(splitStr, contactModal);

fs.writeFileSync('src/App.tsx', appCode);
console.log("Success");
