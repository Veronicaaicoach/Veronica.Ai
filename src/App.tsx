import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Activity, User, LogOut, CreditCard, CircleCheck, Lock, Trash2, AlertCircle, Calendar, Sparkles, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { pcmToBase64, playAudioChunk } from './audio';
import { AuthScreen } from './components/AuthScreen';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser, deleteUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';

type CallState = 'idle' | 'connecting' | 'connected' | 'analyzing' | 'error';
type Tab = 'practice' | 'feedback' | 'pricing';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('practice');
  const [callState, setCallState] = useState<CallState>('idle');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [personality, setPersonality] = useState<string>('Practice conversations');
  const [feedback, setFeedback] = useState<any>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const maxVolRef = useRef(0);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load subscription data from Firestore with 1-month expiration check
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.subscriptionPlan === 'premium') {
              if (data.premiumExpiresAt) {
                const expiresTime = new Date(data.premiumExpiresAt).getTime();
                const now = Date.now();
                if (expiresTime > now) {
                  setIsPremium(true);
                  setPremiumExpiresAt(data.premiumExpiresAt);
                } else {
                  // 1-month subscription period has expired
                  setIsPremium(false);
                  setPremiumExpiresAt(data.premiumExpiresAt);
                  updateDoc(doc(db, 'users', currentUser.uid), { subscriptionPlan: 'expired' }).catch(console.warn);
                }
              } else {
                // Fallback for earlier records: set 1 month
                setIsPremium(true);
                const fallbackExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                setPremiumExpiresAt(fallbackExpiry);
              }
            } else {
              setIsPremium(false);
              setPremiumExpiresAt(null);
            }
          }
        } catch (docErr) {
          console.warn('Error reading user subscription doc:', docErr);
        }
        
        // Load daily usage
        const today = new Date().toISOString().split('T')[0];
        try {
          const usageDoc = await getDoc(doc(db, 'daily_usage', `${currentUser.uid}_${today}`));
          if (usageDoc.exists()) {
            const data = usageDoc.data();
            const allowed = data.allowed_seconds || 300;
            const used = data.used_seconds || 0;
            setTimeLeft(Math.max(0, allowed - used));
          } else {
            setTimeLeft(300);
          }
        } catch (usageErr) {
          console.warn('Error reading daily usage doc:', usageErr);
          setTimeLeft(300);
        }
      } else {
        setIsPremium(false);
        setPremiumExpiresAt(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeletingAccount(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await deleteDoc(doc(db, 'daily_usage', `${user.uid}_${today}`));
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
    } catch (err: any) {
      console.warn('Error deleting account:', err);
      // Even if firestore delete fails due to rules or something, attempt auth delete
      try {
        await deleteUser(user);
      } catch (e) {}
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  const loadRazorpay = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setIsPaymentLoading(true);
    setPaymentError('');
    setPaymentSuccess('');
    
    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded || !(window as any).Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your network connection.');
      }
      
      // STEP 1: Create Order via Backend Endpoint
      const createRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 50000, // 50000 paise = 500 INR (>= 100 paise)
          currency: 'INR',
          receipt: `receipt_${Date.now()}`
        })
      });

      if (!createRes.ok) {
        const errorData = await createRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create payment order (Status ${createRes.status})`);
      }
      
      const orderData = await createRes.json();
      const orderId = orderData.order_id;
      const keyId = orderData.key_id || (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;

      if (!orderId) {
        throw new Error('No order ID received from backend order creation');
      }

      // STEP 2: Open Razorpay Standard Checkout Modal for 1-Month Plan
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Veronica AI',
        description: '1-Month Unlimited Premium Pass (30 Days)',
        order_id: orderId,
        prefill: {
          name: user?.displayName || '',
          email: user?.email || '',
        },
        theme: {
          color: '#EC4899'
        },
        notes: {
          plan: '1_month_premium',
          duration: '30_days',
          type: 'one_time_1_month'
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            setIsPaymentLoading(true);
            // STEP 3: Verify Payment Signature via Backend
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
            });

            const verifyData = await verifyRes.json().catch(() => ({}));

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment signature verification failed');
            }

            // 1-Month Premium successfully verified and activated
            const expiryIso = verifyData.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            setIsPremium(true);
            setPremiumExpiresAt(expiryIso);
            setPaymentSuccess('Payment verified! Your 1-Month Premium Pass is active for 30 days.');
            if (user) {
              updateDoc(doc(db, 'users', user.uid), { 
                subscriptionPlan: 'premium',
                subscriptionDuration: '1_month',
                premiumPurchasedAt: new Date().toISOString(),
                premiumExpiresAt: expiryIso,
                lastPaymentId: response.razorpay_payment_id,
                lastOrderId: response.razorpay_order_id,
              }).catch((e) => {
                console.warn('Error saving premium subscription to firestore:', e);
              });
            }
          } catch (verifyError: any) {
            console.error('Verification error:', verifyError);
            setPaymentError(verifyError.message || 'Payment signature verification failed.');
          } finally {
            setIsPaymentLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsPaymentLoading(false);
            setPaymentError('Payment was cancelled or modal was closed.');
          }
        }
      };
      
      const paymentObject = new (window as any).Razorpay(options);
      
      paymentObject.on('payment.failed', function (failedResponse: any) {
        console.error('Razorpay payment failed:', failedResponse.error);
        const reason = failedResponse.error?.description || failedResponse.error?.reason || 'Payment could not be processed';
        setPaymentError(`Payment failed: ${reason}`);
        setIsPaymentLoading(false);
      });

      paymentObject.open();
    } catch (err: any) {
      console.error('Payment checkout error:', err);
      setPaymentError(err.message || 'Payment initialization failed. Please check server keys.');
      setIsPaymentLoading(false);
    }
  };

  const startCall = async () => {
    if (callState !== 'idle' && callState !== 'error') return;
    
    if (!isPremium && timeLeft <= 0) {
      setActiveTab('pricing');
      return;
    }

    setCallState('connecting');

    if (!isPremium) {
      if (user) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const usageDoc = await getDoc(doc(db, 'daily_usage', `${user.uid}_${today}`));
          let currentLeft = 300;
          if (usageDoc.exists()) {
            const data = usageDoc.data();
            currentLeft = Math.max(0, (data.allowed_seconds || 300) - (data.used_seconds || 0));
          }
          setTimeLeft(currentLeft);
          if (currentLeft <= 0) {
            setActiveTab('pricing');
            setCallState('idle');
            return;
          }
        } catch (e) {
          console.warn("Error fetching usage doc:", e);
        }
      } else if (timeLeft <= 0) {
        setActiveTab('pricing');
        setCallState('idle');
        return;
      }
    }
    
    try {
      setErrorMsg('');

      // Input: 16kHz for mic capture
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;
      
      // Output: 24kHz for model output playback
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;
      activeSourcesRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      // Deprecated but widely supported for raw PCM extraction
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      maxVolRef.current = 0;

      source.connect(processor);
      const gainNode = inputCtx.createGain();
      gainNode.gain.value = 0;
      processor.connect(gainNode);
      gainNode.connect(inputCtx.destination);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = user ? await user.getIdToken() : '';
      const wsUrl = `${protocol}//${window.location.host}/live?personality=${encodeURIComponent(personality)}&token=${encodeURIComponent(token)}&timeLeft=${timeLeft}&isPremium=${isPremium}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setCallState('connected');
        if (outputCtx.state === 'suspended') {
          await outputCtx.resume();
        }
        if (inputCtx.state === 'suspended') {
          await inputCtx.resume();
        }
      };

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          for (let i = 0; i < inputData.length; i++) {
            const val = Math.abs(inputData[i]);
            if (val > maxVolRef.current) maxVolRef.current = val;
          }
          
          const base64 = pcmToBase64(inputData);
          ws.send(JSON.stringify({ audio: base64 }));
        }
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "init") {
          setTimeLeft(msg.timeLeft);
        }
        if (msg.type === "time_expired") {
          stopCall(true);
          setActiveTab('pricing');
          return;
        }
        if (msg.audio) {
          playAudioChunk(outputCtx, msg.audio, nextStartTimeRef, activeSourcesRef.current);
        }
        if (msg.interrupted) {
          nextStartTimeRef.current = 0;
          activeSourcesRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
          });
          activeSourcesRef.current = [];
        }
        if (msg.feedback) {
          try {
            const data = JSON.parse(msg.feedback);
            setFeedback(data);
            setActiveTab('feedback');
            setCallState('idle');
          } catch(e) {}
        }
      };

      ws.onerror = (e) => {
        console.warn('WebSocket error', e);
        setErrorMsg('Connection error.');
        setCallState('error');
      };

      ws.onclose = () => {
        if (callState !== 'analyzing') {
           setCallState('idle');
        }
      };

    } catch (err: any) {
      console.warn(err);
      setErrorMsg(err.message || 'Failed to start call');
      setCallState('error');
    }
  };

  const stopCall = (skipFeedback = false) => {
    if (callState === 'analyzing') {
      if (wsRef.current) wsRef.current.close();
      setCallState('idle');
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (skipFeedback) {
        wsRef.current.close();
      } else {
        const userSpoke = maxVolRef.current > 0.15;
        wsRef.current.send(JSON.stringify({ close: true, userSpoke }));
      }
    }
    
    if (skipFeedback) {
      setCallState('idle');
      activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      activeSourcesRef.current = [];
    } else {
      setCallState('analyzing');
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
  };

  useEffect(() => {
    let interval: number | ReturnType<typeof setInterval>;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setIsAiSpeaking(activeSourcesRef.current.length > 0);
      }, 100);
    } else {
      setIsAiSpeaking(false);
    }
    return () => clearInterval(interval as number);
  }, [callState]);

  useEffect(() => {
    let timerInterval: number | ReturnType<typeof setInterval>;
    if (callState === 'connected' && !isPremium) {
      if (timeLeft > 0) {
        timerInterval = setInterval(() => {
          setTimeLeft((prev) => {
            const next = Math.max(0, prev - 1);
            if (next <= 0) {
              stopCall(true);
              setActiveTab('pricing');
            }
            return next;
          });
        }, 1000);
      }
    }
    return () => clearInterval(timerInterval as number);
  }, [callState, isPremium]);

  useEffect(() => {
    let usageInterval: number | ReturnType<typeof setInterval>;
    if (callState === 'connected' && !isPremium && user) {
      usageInterval = setInterval(async () => {
        try {
          const today = new Date().toISOString().split('T')[0];
          const docRef = doc(db, 'daily_usage', `${user.uid}_${today}`);
          const usageDoc = await getDoc(docRef);
          if (usageDoc.exists()) {
            const data = usageDoc.data();
            const used = (data.used_seconds || 0) + 5;
            await setDoc(docRef, { used_seconds: Math.min(300, used), remaining_seconds: Math.max(0, 300 - used), updated_at: new Date().toISOString() }, { merge: true });
          } else {
            await setDoc(docRef, { user_id: user.uid, usage_date: today, allowed_seconds: 300, used_seconds: 5, remaining_seconds: 295, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          }
        } catch (e) {
          console.warn("Failed to update usage", e);
        }
      }, 5000);
    }
    return () => clearInterval(usageInterval as number);
  }, [callState, isPremium, user]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (inputAudioCtxRef.current) inputAudioCtxRef.current.close();
      if (outputAudioCtxRef.current) outputAudioCtxRef.current.close();
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-pink-500/20 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${callState !== 'idle' && callState !== 'error' ? 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'bg-white/20'}`}></div>
          <span className="text-xs font-medium tracking-[0.2em] uppercase opacity-80">
            System Status: <span className={callState !== 'idle' && callState !== 'error' ? 'text-pink-500' : ''}>{callState !== 'idle' && callState !== 'error' ? 'Active' : 'Inactive'}</span>
          </span>
        </div>
          <div className="flex flex-col items-end gap-2 relative">
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
                onClick={() => signOut(auth)}
                className="text-xs text-white/60 hover:text-white transition-colors flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                Sign Out
              </button>
            </div>
            
            <AnimatePresence>
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute top-8 right-0 bg-zinc-900 border border-white/10 p-4 rounded-xl shadow-2xl z-50 w-64"
                >
                  <p className="text-xs text-white/80 mb-4 leading-relaxed">
                    Are you sure you want to permanently delete your account? This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                      className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {isDeletingAccount ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeletingAccount}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white/80 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              {isPremium ? (
                <span className="text-[10px] uppercase tracking-wider text-pink-400 border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 rounded-full font-medium">
                  Premium (1 Mo)
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-white/40 border border-white/10 bg-white/5 px-2 py-0.5 rounded-full">
                  Free Tier
                </span>
              )}
              <div className="text-xs font-mono opacity-40">v2.1.0</div>
            </div>
          {callState === 'connected' && (
            <div className={`text-xs font-mono opacity-80 ${!isPremium ? 'text-pink-500 animate-pulse' : 'text-pink-500'}`}>
              {isPremium ? 'Endless Time' : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto pb-6">
        <AnimatePresence mode="wait">
          {activeTab === 'practice' && (
            <motion.div
              key="practice"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto"
            >
              <div className="mb-12 text-center">
                <span className="text-sm font-medium tracking-[0.3em] uppercase">VERONICA <span className="text-pink-500">AI</span></span>
                {callState === 'idle' && (
                  <div className="mt-6">
                    <p className="text-sm text-white/40 font-light mb-4">Select Practice Module</p>
                    <select 
                      value={personality} 
                      onChange={(e) => setPersonality(e.target.value)}
                      className="bg-[#1A1A1A] border border-white/10 text-white text-sm rounded-full px-6 py-3 outline-none cursor-pointer hover:bg-[#2A2A2A] transition-colors w-full text-center font-light tracking-wide"
                    >
                      <option className="bg-[#1A1A1A] text-white" value="Practice conversations">Practice Conversations</option>
                      <option className="bg-[#1A1A1A] text-white" value="Flirting practice">Flirting Practice</option>
                      <option className="bg-[#1A1A1A] text-white" value="Dating advice">Dating Advice</option>
                      <option className="bg-[#1A1A1A] text-white" value="Confidence building">Confidence Building</option>
                    </select>
                    {personality === 'Practice conversations' && (
                      <p className="text-[11px] text-white/50 mt-3 max-w-xs mx-auto font-light leading-relaxed">
                        Start, maintain & naturally develop conversations (Focus: natural flow, not 'perfect lines')
                      </p>
                    )}
                    {personality === 'Flirting practice' && (
                      <p className="text-[11px] text-pink-400/80 mt-3 max-w-xs mx-auto font-light leading-relaxed">
                        Playful banter, teasing, genuine compliments & escalation
                      </p>
                    )}
                    {personality === 'Dating advice' && (
                      <p className="text-[11px] text-amber-300/80 mt-3 max-w-xs mx-auto font-light leading-relaxed">
                        Honest guidance on texting, first dates, reading interest & boundaries
                      </p>
                    )}
                    {personality === 'Confidence building' && (
                      <p className="text-[11px] text-emerald-300/80 mt-3 max-w-xs mx-auto font-light leading-relaxed">
                        Overcoming hesitation, handling awkward moments & progressive social challenges
                      </p>
                    )}
                  </div>
                )}
                {callState === 'analyzing' && (
                   <div className="mt-8 text-sm font-light text-pink-500 animate-pulse tracking-wide">Generating coaching feedback...</div>
                )}
                {errorMsg && (
                  <div className="mt-4 text-xs font-mono text-red-400 bg-red-400/10 px-4 py-2 rounded-full border border-red-400/20">
                    {errorMsg}
                  </div>
                )}
              </div>

              <div className="relative mb-12">
                <div className="absolute inset-0 bg-pink-500/10 blur-[100px] rounded-full"></div>
                <div className="absolute inset-0 bg-transparent blur-[50px] rounded-full border border-pink-500/20"></div>
                
                <button
                  onClick={callState === 'idle' || callState === 'error' ? startCall : stopCall}
                  className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                    callState === 'idle' || callState === 'error'
                      ? 'bg-black border border-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.3)]'
                      : callState === 'connecting'
                      ? 'bg-black border border-pink-500 shadow-[0_0_40px_rgba(236,72,153,0.5)]'
                      : callState === 'analyzing'
                      ? 'bg-black border border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.3)]'
                      : 'bg-black border-2 border-pink-500 shadow-[0_0_60px_rgba(236,72,153,0.6)]'
                  }`}
                >
                  {callState === 'connected' && !isAiSpeaking && (
                    <div className="absolute w-[110%] h-[110%] rounded-full border border-pink-500/50 scale-105 animate-pulse"></div>
                  )}
                  {isAiSpeaking && (
                    <>
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute inset-0 rounded-full border border-pink-500/40"
                          initial={{ scale: 1, opacity: 0.8 }}
                          animate={{ scale: 2.5, opacity: 0 }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeOut",
                            delay: i * 0.6,
                          }}
                        />
                      ))}
                    </>
                  )}
                  {callState === 'idle' || callState === 'error' ? (
                    <Mic className="w-8 h-8 text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                  ) : callState === 'connecting' || callState === 'analyzing' ? (
                    <Activity className="w-8 h-8 text-pink-500 animate-pulse drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                  ) : (
                    <MicOff className="w-8 h-8 text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                  )}
                </button>
              </div>

              <div className={`mt-8 text-center text-[10px] uppercase tracking-widest ${callState === 'connected' ? 'text-pink-500' : 'text-white/40'}`}>
                {callState === 'idle' || callState === 'error' ? 'INITIATE VOICE LINK' : callState === 'analyzing' ? 'DISMISS FEEDBACK' : 'TERMINATE LINK'}
              </div>
            </motion.div>
          )}

          {activeTab === 'feedback' && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto px-4 py-8 pb-32"
            >
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] opacity-60 mb-8 text-center mt-4">Session Feedback</h2>
              <div className="space-y-4">
                {feedback ? (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="font-light tracking-wide text-white/90">Latest Session</h3>
                      </div>
                      <span className="bg-white/10 border border-white/10 text-white/80 text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full">
                        Score: {feedback.score || '--'}/100
                      </span>
                    </div>
                    
                    <div className="mb-6">
                      <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 mb-2">Summary</h4>
                      <p className="text-white/80 text-sm font-light leading-relaxed">
                        {feedback.summary}
                      </p>
                    </div>
                    
                    {feedback.categories && Object.keys(feedback.categories).length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 mb-3">Categories</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(feedback.categories).map(([key, value]) => {
                            const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return (
                              <div key={key} className="flex justify-between items-center bg-black/20 px-3 py-2 rounded-lg border border-white/5">
                                <span className="text-xs font-light text-white/70">{formattedKey}</span>
                                <span className="text-xs font-medium text-white/90">{String(value)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {feedback.strengths && feedback.strengths.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-pink-500/80 mb-3">What You Did Well</h4>
                        <ul className="space-y-2">
                          {feedback.strengths.map((s: string, i: number) => (
                             <li key={i} className="flex items-start gap-3 text-sm font-light text-white/70">
                               <span className="text-pink-500 mt-0.5 flex-shrink-0">✓</span>
                               <span className="leading-relaxed">{s}</span>
                             </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {feedback.improvements && feedback.improvements.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/60 mb-3">What You Can Improve</h4>
                        <ul className="space-y-2">
                          {feedback.improvements.map((s: string, i: number) => (
                             <li key={i} className="flex items-start gap-3 text-sm font-light text-white/70">
                               <span className="text-white/40 mt-0.5 flex-shrink-0">!</span>
                               <span className="leading-relaxed">{s}</span>
                             </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {feedback.better_responses && feedback.better_responses.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-pink-500/80 mb-3">Better Responses</h4>
                        <div className="space-y-4">
                          {feedback.better_responses.map((br: any, i: number) => (
                            <div key={i} className="bg-black/40 p-4 rounded-xl border border-white/5">
                              <div className="mb-3">
                                <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Instead of saying:</span>
                                <p className="text-sm font-light text-white/60 italic">"{br.original}"</p>
                              </div>
                              <div className="mb-3">
                                <span className="text-[10px] uppercase tracking-wider text-pink-500/60 block mb-1">Try saying:</span>
                                <p className="text-sm font-medium text-pink-400/90">"{br.better}"</p>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Why?</span>
                                <p className="text-xs font-light text-white/60">{br.why}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {feedback.practice_focus && (
                      <div className="mt-6 pt-6 border-t border-white/10">
                        <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-pink-500/80 mb-2">Recommended Practice</h4>
                        <p className="text-sm font-light text-white/80 leading-relaxed">
                          {feedback.practice_focus}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-white/40 font-light py-12 border border-white/5 rounded-2xl bg-white/5">
                    No recent sessions found. Practice with Veronica to generate feedback.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'pricing' && (
            <motion.div
              key="pricing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto px-4 py-8 pb-32"
            >
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] opacity-60 mb-8 text-center mt-4">Pricing Plans</h2>

              {/* Premium 1-Month Subscription Card */}
              <div className={`rounded-2xl p-8 border backdrop-blur-sm mb-6 text-center transition-all ${isPremium ? 'bg-pink-500/10 border-pink-500/30 shadow-[0_0_30px_rgba(236,72,153,0.1)]' : 'bg-white/5 border-white/10'}`}>
                {isPremium ? (
                  <>
                    <div className="flex justify-center mb-4">
                      <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                        <CircleCheck className="w-6 h-6 text-pink-500" />
                      </div>
                    </div>
                    <div className="inline-block mb-3 px-3 py-1 rounded-full bg-pink-500/20 text-pink-400 text-[11px] font-medium tracking-widest uppercase border border-pink-500/30">
                      1-Month Access Active
                    </div>
                    <h3 className="font-light tracking-wide text-white/90 text-xl mb-2">Premium Unlocked</h3>
                    <p className="text-sm font-light text-white/60 max-w-md mx-auto mb-4">
                      You have full 1-month unlimited access to all coaching modules and infinite practice time.
                    </p>

                    {premiumExpiresAt && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/50 border border-pink-500/30 text-xs text-pink-300 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                        <span>Expires on {new Date(premiumExpiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        <span className="text-pink-500/60">•</span>
                        <span className="text-white/80">{Math.max(0, Math.ceil((new Date(premiumExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-pink-400" />
                      </div>
                    </div>
                    <div className="inline-block mb-2 px-3 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[10px] font-semibold tracking-widest uppercase">
                      1 Month Plan Only
                    </div>
                    <h3 className="font-light tracking-wide text-white/90 text-3xl mb-1">₹500 <span className="text-sm text-white/40 font-normal">/ 1 month</span></h3>
                    <p className="text-xs font-light text-pink-400/90 mb-4 tracking-wide">30-day all-inclusive access pass</p>
                    <p className="text-sm font-light text-white/60 mb-6 px-4 max-w-md mx-auto">
                      Upgrade to Premium for 1 full month of unlimited conversation practice, all emotional coaching modules, and in-depth AI feedback analysis.
                    </p>

                    {/* Features list */}
                    <div className="max-w-md mx-auto mb-6 text-left space-y-2.5 bg-black/40 p-4 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2.5 text-xs font-light text-white/80">
                        <Clock className="w-4 h-4 text-pink-400 shrink-0" />
                        <span><strong>1-Month Duration:</strong> Active for 30 calendar days from activation</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs font-light text-white/80">
                        <CircleCheck className="w-4 h-4 text-pink-400 shrink-0" />
                        <span><strong>Infinite Practice:</strong> No 5-min daily limit during the month</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs font-light text-white/80">
                        <CircleCheck className="w-4 h-4 text-pink-400 shrink-0" />
                        <span><strong>All Modules:</strong> Unrestricted voice sessions across all modes</span>
                      </div>
                    </div>
                    
                    {paymentError && (
                      <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-left max-w-md mx-auto">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        <p className="text-xs text-red-200">{paymentError}</p>
                      </div>
                    )}

                    {paymentSuccess && (
                      <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-left max-w-md mx-auto">
                        <CircleCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <p className="text-xs text-emerald-200">{paymentSuccess}</p>
                      </div>
                    )}

                    <button 
                      id="razorpay-checkout-button"
                      onClick={handlePayment} 
                      disabled={isPaymentLoading}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-pink-500 hover:bg-pink-400 text-black text-sm font-semibold transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                    >
                      {isPaymentLoading ? 'Processing Checkout...' : 'Upgrade for 1 Month - ₹500'}
                    </button>
                    <p className="text-[11px] text-white/30 mt-3 font-light">Valid for 30 days from purchase • Secured with Razorpay Standard Checkout</p>
                  </>
                )}
              </div>

              {/* Promo Code Section */}
              {!isPremium && (
                <div className="mt-8 text-center">
                  <div className="relative flex items-center justify-center my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative bg-[#0A0A0A] px-4 text-xs font-medium uppercase tracking-widest text-white/40">
                      Or
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                    <h3 className="text-sm font-light text-white/80 mb-4">Have a promo code?</h3>
                    <div className="flex gap-2 max-w-sm mx-auto">
                      <input 
                        type="text"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoError('');
                        }}
                        placeholder="ENTER CODE"
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm font-medium tracking-widest text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50 transition-colors uppercase"
                      />
                      <button 
                        onClick={() => {
                          if (promoCode === 'VERONICA2026' || promoCode === 'VERONICA_PRO') {
                            const oneMonthLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                            setIsPremium(true);
                            setPremiumExpiresAt(oneMonthLater);
                            setPromoCode('');
                            setPromoError('');
                            setPaymentSuccess('Promo code applied! 1-Month Premium Pass activated for 30 days.');
                            if (user) {
                              updateDoc(doc(db, 'users', user.uid), {
                                subscriptionPlan: 'premium',
                                subscriptionDuration: '1_month',
                                premiumPurchasedAt: new Date().toISOString(),
                                premiumExpiresAt: oneMonthLater,
                                promoCodeApplied: promoCode,
                              }).catch(console.warn);
                            }
                          } else {
                            setPromoError('Invalid code');
                          }
                        }}
                        className="px-6 py-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 hover:text-pink-400 text-xs font-medium uppercase tracking-widest transition-all border border-pink-500/30 hover:shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                      >
                        Apply
                      </button>
                    </div>
                    {promoError && (
                      <p className="text-pink-500 text-xs mt-2">{promoError}</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-[#050505]/80 backdrop-blur-xl border-t border-white/5 fixed bottom-0 w-full z-20 pb-env">
        <div className="flex justify-center items-center gap-2 max-w-md mx-auto p-4">
          <button 
            onClick={() => setActiveTab('feedback')}
            className={`flex-1 py-3 rounded-full border text-xs font-medium uppercase tracking-widest transition-all ${
              activeTab === 'feedback' 
                ? 'bg-transparent border-pink-500 text-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]' 
                : 'bg-transparent border-transparent text-white/40 hover:text-white/80'
            }`}
          >
            Feedback
          </button>
          
          <button 
            onClick={() => setActiveTab('practice')}
            className={`flex-1 py-3 rounded-full border text-xs font-medium uppercase tracking-widest transition-all ${
              activeTab === 'practice' 
                ? 'bg-transparent border-pink-500 text-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]' 
                : 'bg-transparent border-transparent text-white/40 hover:text-white/80'
            }`}
          >
            Core
          </button>
          
          <button 
            onClick={() => setActiveTab('pricing')}
            className={`flex-1 py-3 rounded-full border text-xs font-medium uppercase tracking-widest transition-all ${
              activeTab === 'pricing' 
                ? 'bg-transparent border-pink-500 text-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]' 
                : 'bg-transparent border-transparent text-white/40 hover:text-white/80'
            }`}
          >
            Pricing
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
