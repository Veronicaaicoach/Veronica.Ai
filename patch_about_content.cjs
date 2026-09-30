const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldModalContent = `<div className="space-y-6">
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
              </div>`;

const newModalContent = `<div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-mono text-sm">✦</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1 tracking-wide">Who We Are</h4>
                    <p className="text-xs text-white/60 leading-relaxed font-light">
                      Veronica is an AI-powered Dating & Social Confidence Coach designed to help you communicate more naturally and confidently.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-mono text-sm">◈</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1 tracking-wide">What We Do</h4>
                    <p className="text-xs text-white/60 leading-relaxed font-light">
                      Practice conversations, respectful flirting, dating situations, and confidence-building through realistic voice interactions.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-mono text-sm">🎯</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1 tracking-wide">Our Goal</h4>
                    <p className="text-xs text-white/60 leading-relaxed font-light">
                      We help you learn from every conversation, improve your communication, and develop the confidence to build genuine connections in the real world.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 text-center text-xs font-medium tracking-wide text-pink-400/90 italic">
                Practice with Veronica. Build confidence. Connect better.
              </div>`;

code = code.replace(oldModalContent, newModalContent);

const oldHeader = `<div className="mb-6">
                <span className="text-sm font-medium tracking-[0.3em] uppercase">About <span className="text-pink-500">Veronica</span></span>
                <p className="text-xs text-white/50 font-light mt-2">
                  Philosophy & Privacy
                </p>
              </div>`;
              
const newHeader = `<div className="mb-6">
                <span className="text-sm font-medium tracking-[0.3em] uppercase">About <span className="text-pink-500">Veronica</span></span>
              </div>`;

code = code.replace(oldHeader, newHeader);

fs.writeFileSync('src/App.tsx', code);
console.log("Success");
