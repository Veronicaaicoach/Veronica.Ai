const fs = require('fs');

// 1. Patch Sidebar.tsx
let sidebarCode = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebarCode = sidebarCode.replace(
  `export function Sidebar({ onHowItWorksClick, onAboutClick, onContactClick, onHelpClick }: { onHowItWorksClick?: () => void, onAboutClick?: () => void, onContactClick?: () => void, onHelpClick?: () => void }) {`,
  `export function Sidebar({ onHowItWorksClick, onAboutClick, onContactClick, onHelpClick, onSettingsClick }: { onHowItWorksClick?: () => void, onAboutClick?: () => void, onContactClick?: () => void, onHelpClick?: () => void, onSettingsClick?: () => void }) {`
);
sidebarCode = sidebarCode.replace(
  `<SidebarItem isExpanded={isExpanded} icon={<Settings className="w-5 h-5" />} label="Settings" />`,
  `<SidebarItem isExpanded={isExpanded} icon={<Settings className="w-5 h-5" />} label="Settings" onClick={onSettingsClick} />`
);
fs.writeFileSync('src/components/Sidebar.tsx', sidebarCode);


// 2. Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// A. Remove existing account display from Header
appCode = appCode.replace(
  `<div className="flex flex-col items-end gap-2 relative">
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono opacity-40">{user.email}</span>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-pink-500/80 hover:text-pink-500 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete Account
              </button>
              <button 
                onClick={() => {
                  sessionStorage.removeItem('tempPremium');
                  signOut(auth);
                }}
                className="text-xs text-white/60 hover:text-white transition-colors flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                Sign Out
              </button>
            </div>
            
            <AnimatePresence>`,
  `<div className="flex flex-col items-end gap-2 relative">
            <AnimatePresence>`
);

// B. State
appCode = appCode.replace(
  `const [expandedFaq, setExpandedFaq] = useState<number | null>(null);`,
  `const [expandedFaq, setExpandedFaq] = useState<number | null>(null);\n  const [showSettingsModal, setShowSettingsModal] = useState(false);`
);

// C. Sidebar Props
appCode = appCode.replace(
  `onHelpClick={() => setShowHelpModal(true)} />`,
  `onHelpClick={() => setShowHelpModal(true)} onSettingsClick={() => setShowSettingsModal(true)} />`
);

// D. Modal UI
const splitStr = `{/* Feedback Locked Modal for Free Users after Call Terminates */}`;
const settingsModal = `
      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0e0e0e] border border-white/15 rounded-3xl max-w-sm w-full p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <span className="text-sm font-medium tracking-[0.3em] uppercase">Account <span className="text-pink-500">Settings</span></span>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-semibold tracking-wider text-white/50 uppercase mb-3">Profile</h4>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 font-medium shrink-0">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                        <p className="text-xs text-white/40 mt-0.5">{isPremium ? 'Premium Tier' : 'Free Tier'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold tracking-wider text-white/50 uppercase mb-3">Danger Zone</h4>
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full flex items-center justify-between bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors rounded-xl p-4 group"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-red-400 group-hover:text-red-300">Delete Account</p>
                      <p className="text-xs text-red-500/60 mt-0.5">Permanently remove your data</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <button
                  onClick={async () => {
                    try {
                      sessionStorage.removeItem('tempPremium');
                      await signOut(auth);
                    } catch (error) {
                      console.error("Error signing out:", error);
                    }
                  }}
                  className="w-full py-3 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold uppercase tracking-widest transition-all mb-3 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-3 rounded-full bg-transparent hover:bg-white/5 text-white/60 hover:text-white text-xs font-semibold uppercase tracking-widest transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Feedback Locked Modal for Free Users after Call Terminates */}`;

appCode = appCode.replace(splitStr, settingsModal);

fs.writeFileSync('src/App.tsx', appCode);
console.log("Success");
