import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Activity, User, LogOut, CreditCard, CircleCheck, Lock, Trash2, AlertCircle, Calendar, Sparkles, Clock, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { pcmToBase64, playAudioChunk } from './audio';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
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
  const [loadingPlan, setLoadingPlan] = useState<'1_week' | '1_month' | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);
  const [subscriptionDuration, setSubscriptionDuration] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showFeedbackLockedModal, setShowFeedbackLockedModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);

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
        // Load subscription data from Firestore with expiration check
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
                  setSubscriptionDuration(data.subscriptionDuration || '1_month');
                } else {
                  // Subscription period has expired
                  setIsPremium(false);
                  setPremiumExpiresAt(data.premiumExpiresAt);
                  setSubscriptionDuration(null);
                  updateDoc(doc(db, 'users', currentUser.uid), { subscriptionPlan: 'expired' }).catch(console.warn);
                }
              } else {
                // Fallback for earlier records: set 1 month
                setIsPremium(true);
                const fallbackExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                setPremiumExpiresAt(fallbackExpiry);
                setSubscriptionDuration(data.subscriptionDuration || '1_month');
              }
            } else {
              if (sessionStorage.getItem('tempPremium') === 'true') {
                setIsPremium(true);
                setPremiumExpiresAt(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
                setSubscriptionDuration('1_month');
              } else {
                setIsPremium(false);
                setPremiumExpiresAt(null);
                setSubscriptionDuration(null);
              }
            }

            if (data.latestFeedback) {
              setFeedback(data.latestFeedback);
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
        setSubscriptionDuration(null);
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

  const handlePayment = async (planType: '1_week' | '1_month' = '1_week') => {
    setIsPaymentLoading(true);
    setLoadingPlan(planType);
    setPaymentError('');
    setPaymentSuccess('');
    
    const isWeek = planType === '1_week';
    const amountPaise = isWeek ? 10000 : 50000; // Rs. 100 vs Rs. 500
    const planId = isWeek ? '1_week_premium' : '1_month_premium';
    const planLabel = isWeek ? '1-Week' : '1-Month';
    const planDays = isWeek ? 7 : 30;

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
          amount: amountPaise,
          currency: 'INR',
          plan: planId,
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

      // STEP 2: Open Razorpay Standard Checkout Modal
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Veronica AI',
        description: `${planLabel} Unlimited Premium Pass (${planDays} Days)`,
        order_id: orderId,
        prefill: {
          name: user?.displayName || '',
          email: user?.email || '',
        },
        theme: {
          color: '#EC4899'
        },
        notes: {
          plan: planId,
          duration: `${planDays}_days`,
          type: `one_time_${planType}`
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            setIsPaymentLoading(true);
            setLoadingPlan(planType);
            // STEP 3: Verify Payment Signature via Backend
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: planId,
              })
            });

            const verifyData = await verifyRes.json().catch(() => ({}));

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment signature verification failed');
            }

            // Premium successfully verified and activated
            const expiryIso = verifyData.expires_at || new Date(Date.now() + planDays * 24 * 60 * 60 * 1000).toISOString();
            setIsPremium(true);
            setPremiumExpiresAt(expiryIso);
            setSubscriptionDuration(planType);
            setPaymentSuccess(`Payment verified! Your ${planLabel} Premium Pass is active for ${planDays} days.`);
            if (user) {
              updateDoc(doc(db, 'users', user.uid), { 
                subscriptionPlan: 'premium',
                subscriptionDuration: planType,
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
            setLoadingPlan(null);
          }
        },
        modal: {
          ondismiss: function () {
            setIsPaymentLoading(false);
            setLoadingPlan(null);
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
        setLoadingPlan(null);
      });

      paymentObject.open();
    } catch (err: any) {
      console.error('Payment checkout error:', err);
      setPaymentError(err.message || 'Payment initialization failed. Please check server keys.');
      setIsPaymentLoading(false);
      setLoadingPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancellingSubscription(true);
    setPaymentError('');
    setPaymentSuccess('');
    try {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        try {
          await updateDoc(userRef, {
            subscriptionPlan: 'cancelled',
            subscriptionDuration: null,
            cancelledAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
        }

        // Call backend cancellation endpoint for audit and analytics
        fetch('/api/cancel-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.uid, email: user.email })
        }).catch(console.warn);
      }
      setIsPremium(false);
      setPremiumExpiresAt(null);
      setSubscriptionDuration(null);
      setShowCancelConfirm(false);
      setPaymentSuccess('Your ongoing subscription has been successfully cancelled. Your account has returned to the Free tier.');
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setPaymentError(err.message || 'Failed to cancel subscription. Please try again.');
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  const startCall = async () => {
    if (callState !== 'idle' && callState !== 'error') return;
    
    if (!isPremium && timeLeft <= 0) {
      setActiveTab('pricing');
      return;
    }

    setCallState('connecting');

    if (!isPremium && personality !== 'Practice conversations' && personality !== 'Dating advice') {
      setErrorMsg('This coaching module is locked on the Free Tier. Unlock Premium to access Flirting Practice and Confidence Building.');
      setActiveTab('pricing');
      setCallState('idle');
      return;
    }

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
        if (msg.type === "feedback_locked") {
          setShowFeedbackLockedModal(true);
          setCallState('idle');
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
            const data = typeof msg.feedback === 'string' ? JSON.parse(msg.feedback) : msg.feedback;
            setFeedback(data);
            setActiveTab('feedback');
            setCallState('idle');
            if (user) {
              updateDoc(doc(db, 'users', user.uid), {
                latestFeedback: data,
                lastFeedbackAt: new Date().toISOString()
              }).catch(console.warn);
            }
          } catch(e) {
            console.error('Failed to parse feedback', e);
            setCallState('idle');
          }
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

    // Free users: feedback is locked, never analyze
    if (!isPremium) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ close: true, skipFeedback: true, isPremium: false }));
        wsRef.current.close();
      }
      setCallState('idle');
      activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      activeSourcesRef.current = [];
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (!skipFeedback) {
        setShowFeedbackLockedModal(true);
      }
      return;
    }

    // Premium users: trigger comprehensive analysis and feedback generation
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (skipFeedback) {
        wsRef.current.close();
        setCallState('idle');
      } else {
        const userSpoke = maxVolRef.current > 0.12;
        setCallState('analyzing');
        wsRef.current.send(JSON.stringify({ close: true, userSpoke, isPremium: true }));
      }
    } else {
      setCallState('idle');
    }
    
    if (skipFeedback) {
      setCallState('idle');
    }
    
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    activeSourcesRef.current = [];
    
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
        <div className="absolute left-1/2 -translate-x-1/2 font-medium tracking-[0.3em] uppercase text-sm hidden md:block">Veronica <span className="text-pink-500">AI</span></div>
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
                  {subscriptionDuration === '1_week' ? 'Premium (1 Wk)' : 'Premium (1 Mo)'}
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

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar onHowItWorksClick={() => setShowHowItWorksModal(true)} />
        <div className="flex-1 flex flex-col relative overflow-hidden w-full">

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
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <p className="text-sm text-white/40 font-light">Select Practice Module</p>
                      {!isPremium && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full font-medium">
                          <Lock className="w-2.5 h-2.5 text-pink-400" />
                          <span>Free Tier</span>
                        </span>
                      )}
                    </div>
                    <div className="relative w-full">
                      <select 
                        value={personality} 
                        onChange={(e) => setPersonality(e.target.value)}
                        className="bg-[#1A1A1A] border border-white/10 text-white text-sm rounded-full px-6 py-3 outline-none cursor-pointer hover:bg-[#2A2A2A] transition-colors w-full text-center font-light tracking-wide"
                      >
                        <option className="bg-[#1A1A1A] text-white" value="Practice conversations">
                          Practice Conversations {!isPremium ? '(Free Tier)' : ''}
                        </option>
                        <option className="bg-[#1A1A1A] text-white" value="Dating advice">
                          Dating Advice {!isPremium ? '(Free Tier)' : ''}
                        </option>
                        <option className="bg-[#1A1A1A] text-white" value="Flirting practice">
                          {!isPremium ? '🔒 ' : ''}Flirting Practice {!isPremium ? '(Premium)' : ''}
                        </option>
                        <option className="bg-[#1A1A1A] text-white" value="Confidence building">
                          {!isPremium ? '🔒 ' : ''}Confidence Building {!isPremium ? '(Premium)' : ''}
                        </option>
                      </select>
                      {!isPremium && personality !== 'Practice conversations' && personality !== 'Dating advice' && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-pink-400 flex items-center">
                          <Lock className="w-4 h-4" />
                        </div>
                      )}
                    </div>
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

                    {!isPremium && (
                      (personality !== 'Practice conversations' && personality !== 'Dating advice') && (
                        <div className="mt-3.5 p-3 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-between gap-3 text-left">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shrink-0">
                              <Lock className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-medium text-pink-300 block">Premium Coaching Module Locked</span>
                              <span className="text-[10px] text-white/60">Flirting & Confidence modules require a Premium pass</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('pricing')}
                            className="px-3.5 py-1.5 rounded-full bg-pink-500 hover:bg-pink-400 text-black text-[10px] font-semibold uppercase tracking-wider transition-all shrink-0 shadow-[0_0_10px_rgba(236,72,153,0.3)]"
                          >
                            Unlock
                          </button>
                        </div>
                      )
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
              <div className="text-center mb-8 mt-4">
                <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-pink-500/90 block mb-1">
                  AI Intelligence Report
                </span>
                <h2 className="text-xl font-light tracking-wide text-white">Conversation Feedback & Analysis</h2>
              </div>

              {!isPremium ? (
                /* Premium-Gated Locked State */
                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md text-center relative overflow-hidden">
                  <div className="w-14 h-14 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mx-auto mb-4 text-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                    <Lock className="w-6 h-6" />
                  </div>

                  <span className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 font-medium mb-3">
                    Premium Feature
                  </span>

                  <h3 className="text-lg font-light text-white mb-2">Automated Conversation Analysis is Locked</h3>
                  <p className="text-xs font-light text-white/70 max-w-md mx-auto mb-6 leading-relaxed">
                    Unlock Premium to generate comprehensive AI feedback after every conversation ends. Our model analyzes your dialogue, extracts the 5 core conversational parameters, calculates your composite score, and highlights your specific strengths and weaknesses.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto mb-6 text-left">
                    <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-pink-400 flex-shrink-0" />
                        <h4 className="text-xs font-medium text-white">Parameter Extraction</h4>
                      </div>
                      <p className="text-[11px] font-light text-white/60 leading-relaxed">
                        Evaluates Flow, Active Listening & Reciprocity, Confidence, Question Quality, and Emotional Calibration.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <CircleCheck className="w-4 h-4 text-pink-400 flex-shrink-0" />
                        <h4 className="text-xs font-medium text-white">Parameter-Based Score</h4>
                      </div>
                      <p className="text-[11px] font-light text-white/60 leading-relaxed">
                        Objective composite score (0–100) calculated transparently on the basis of your extracted parameters.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-pink-400 flex-shrink-0" />
                        <h4 className="text-xs font-medium text-white">Strengths & Weaknesses</h4>
                      </div>
                      <p className="text-[11px] font-light text-white/60 leading-relaxed">
                        Clear unvarnished breakdown of what made you charismatic and the exact habits holding you back.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-pink-400 flex-shrink-0" />
                        <h4 className="text-xs font-medium text-white">Automatic Generation</h4>
                      </div>
                      <p className="text-[11px] font-light text-white/60 leading-relaxed">
                        Instantly produced the moment your conversation terminates and saved to your profile.
                      </p>
                    </div>
                  </div>

                  {/* Sample Report Preview */}
                  <div className="max-w-lg mx-auto p-4 rounded-2xl bg-black/50 border border-white/10 mb-8 text-left opacity-80">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Sample Report Preview</span>
                      <span className="text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Score: 84/100
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-white/70">
                        <span>Active Listening & Reciprocity</span>
                        <span className="font-mono text-pink-400">88/100</span>
                      </div>
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="w-[88%] bg-pink-500 h-full rounded-full"></div>
                      </div>
                      <div className="flex justify-between text-white/70 pt-1">
                        <span>Confidence & Composure</span>
                        <span className="font-mono text-pink-400">80/100</span>
                      </div>
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="w-[80%] bg-pink-500 h-full rounded-full"></div>
                      </div>
                      <p className="text-[11px] text-white/50 italic pt-1.5 border-t border-white/5">
                        "Strengths: Asked insightful follow-up questions. Weaknesses: Interrupted twice during story transitions."
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('pricing')}
                    className="px-8 py-3.5 rounded-full bg-pink-500 hover:bg-pink-400 text-black text-xs font-semibold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)]"
                  >
                    Unlock Premium to Get Feedback
                  </button>
                </div>
              ) : feedback ? (
                /* Premium Feedback Report */
                <div className="space-y-6">
                  {/* Score & Summary Card */}
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-pink-500/80 font-mono block mb-1">
                          Performance Evaluation
                        </span>
                        <h3 className="text-lg font-light tracking-wide text-white">
                          Latest Conversation Score
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-2xl font-light text-white block">
                            {feedback.score !== undefined ? `${feedback.score}` : '--'}
                            <span className="text-sm text-white/40 font-light">/100</span>
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-pink-400">
                            {Number(feedback.score) >= 80 ? 'Mastery / Charismatic' : Number(feedback.score) >= 65 ? 'Strong Communicator' : 'Developing'}
                          </span>
                        </div>
                        <div className="w-12 h-12 rounded-full border-2 border-pink-500 flex items-center justify-center bg-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                          <Sparkles className="w-5 h-5 text-pink-400" />
                        </div>
                      </div>
                    </div>

                    {/* Score Basis Explanation */}
                    <div className="mt-4 p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-start gap-2.5">
                      <CircleCheck className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs font-light text-white/80 leading-relaxed">
                        <strong className="text-pink-300 font-medium">Score Basis: </strong>
                        {feedback.score_basis_explanation || 'Score calculated on the basis of the 5 extracted parameters: Flow, Listening, Confidence, Engagement, and Calibration.'}
                      </p>
                    </div>

                    {/* Summary */}
                    <div className="mt-5">
                      <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 mb-2">Executive Summary</h4>
                      <p className="text-white/80 text-sm font-light leading-relaxed">
                        {feedback.summary}
                      </p>
                    </div>
                  </div>

                  {/* Section: Main Extracted Parameters */}
                  {((feedback.parameters && Array.isArray(feedback.parameters) && feedback.parameters.length > 0) || (feedback.categories && Object.keys(feedback.categories).length > 0)) && (
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                      <div className="mb-4">
                        <span className="text-[10px] uppercase tracking-widest text-pink-500/80 font-mono block mb-1">
                          Core Dimensions
                        </span>
                        <h4 className="text-base font-light text-white">Main Extracted Parameters</h4>
                        <p className="text-xs font-light text-white/50 mt-0.5">
                          Detailed breakdown of the conversation across 5 primary communication pillars:
                        </p>
                      </div>

                      <div className="space-y-4 pt-2">
                        {(feedback.parameters && Array.isArray(feedback.parameters) && feedback.parameters.length > 0
                          ? feedback.parameters
                          : Object.entries(feedback.categories || {}).map(([k, v]) => ({
                              name: k.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                              score: typeof v === 'number' ? v : parseInt(String(v), 10) || 0,
                              status: Number(v) >= 80 ? 'Excellent' : Number(v) >= 60 ? 'Strong' : 'Developing',
                              observation: `Evaluated performance for ${k.replace(/_/g, ' ')}.`
                            }))
                        ).map((param: any, idx: number) => {
                          const paramScore = typeof param.score === 'number' ? param.score : parseInt(param.score, 10) || 0;
                          return (
                            <div key={idx} className="p-4 rounded-2xl bg-black/40 border border-white/5">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-medium text-white/90">{param.name}</span>
                                <div className="flex items-center gap-2">
                                  {param.status && (
                                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                                      {param.status}
                                    </span>
                                  )}
                                  <span className="text-xs font-mono font-medium text-pink-400">
                                    {paramScore}/100
                                  </span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-2.5">
                                <div 
                                  className="h-full bg-gradient-to-r from-pink-600 to-pink-400 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, Math.max(5, paramScore))}%` }}
                                />
                              </div>

                              {/* Observation */}
                              {param.observation && (
                                <p className="text-xs font-light text-white/70 leading-relaxed">
                                  {param.observation}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section: Strengths and Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="bg-white/5 p-5 rounded-3xl border border-emerald-500/20 backdrop-blur-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <CircleCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <h4 className="text-xs font-medium uppercase tracking-[0.15em] text-emerald-400">
                          Strengths of Conversation
                        </h4>
                      </div>
                      
                      {feedback.strengths && feedback.strengths.length > 0 ? (
                        <ul className="space-y-2.5">
                          {feedback.strengths.map((s: string, i: number) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs font-light text-white/80 leading-relaxed">
                              <span className="text-emerald-400 font-bold mt-0.5">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs font-light text-white/40 italic">Good baseline communication demonstrated.</p>
                      )}
                    </div>

                    {/* Weaknesses */}
                    <div className="bg-white/5 p-5 rounded-3xl border border-rose-500/20 backdrop-blur-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <h4 className="text-xs font-medium uppercase tracking-[0.15em] text-rose-400">
                          Weaknesses of Conversation
                        </h4>
                      </div>
                      
                      {(feedback.weaknesses && feedback.weaknesses.length > 0) ? (
                        <ul className="space-y-2.5">
                          {feedback.weaknesses.map((w: string, i: number) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs font-light text-white/80 leading-relaxed">
                              <span className="text-rose-400 font-bold mt-0.5">•</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (feedback.improvements && feedback.improvements.length > 0) ? (
                        <ul className="space-y-2.5">
                          {feedback.improvements.map((w: string, i: number) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs font-light text-white/80 leading-relaxed">
                              <span className="text-rose-400 font-bold mt-0.5">•</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs font-light text-white/40 italic">No major conversational friction points detected.</p>
                      )}
                    </div>
                  </div>

                  {/* Section: Better Responses */}
                  {feedback.better_responses && feedback.better_responses.length > 0 && (
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-pink-400" />
                        <h4 className="text-xs font-medium uppercase tracking-[0.2em] text-pink-400">
                          Better Responses (Charisma Coaching)
                        </h4>
                      </div>

                      <div className="space-y-4">
                        {feedback.better_responses.map((br: any, i: number) => (
                          <div key={i} className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2.5">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Instead of saying:</span>
                              <p className="text-xs font-light text-white/70 italic bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                                "{br.original}"
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-pink-400 block mb-1">Try saying:</span>
                              <p className="text-xs font-medium text-pink-300 bg-pink-500/10 px-3 py-2 rounded-xl border border-pink-500/20">
                                "{br.better}"
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-0.5">Why this works better:</span>
                              <p className="text-xs font-light text-white/60 leading-relaxed">
                                {br.why}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Practice Focus */}
                  {feedback.practice_focus && (
                    <div className="p-5 rounded-3xl bg-gradient-to-r from-pink-950/30 via-black to-pink-950/20 border border-pink-500/30">
                      <span className="text-[10px] uppercase tracking-widest text-pink-400 font-semibold block mb-1.5">
                        Recommended Focus Drill
                      </span>
                      <p className="text-xs font-light text-white/90 leading-relaxed">
                        {feedback.practice_focus}
                      </p>
                    </div>
                  )}

                  {/* Action button */}
                  <div className="text-center pt-2">
                    <button
                      onClick={() => setActiveTab('practice')}
                      className="px-6 py-3 rounded-full bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-400 text-xs font-medium uppercase tracking-widest transition-all"
                    >
                      Start Another Practice Session
                    </button>
                  </div>
                </div>
              ) : (
                /* Premium User with No Previous Feedback */
                <div className="text-center py-16 px-6 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mx-auto mb-4 text-pink-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-light text-white mb-2">Ready for Your First Analysis</h3>
                  <p className="text-xs font-light text-white/60 max-w-sm mx-auto mb-6 leading-relaxed">
                    You have unlocked Premium! Start a voice call with Veronica in Core practice mode. As soon as your conversation ends, your complete analysis with extracted parameters, overall score, and strengths & weaknesses will appear here.
                  </p>
                  <button
                    onClick={() => setActiveTab('practice')}
                    className="px-6 py-3 rounded-full bg-pink-500 hover:bg-pink-400 text-black text-xs font-semibold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                  >
                    Start Voice Conversation
                  </button>
                </div>
              )}
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

              {/* Active Subscription Status Card (When Unlocked) */}
              {isPremium ? (
                <div className="rounded-2xl p-8 border backdrop-blur-sm mb-6 text-center transition-all bg-pink-500/10 border-pink-500/30 shadow-[0_0_30px_rgba(236,72,153,0.1)]">
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                      <CircleCheck className="w-6 h-6 text-pink-500" />
                    </div>
                  </div>
                  <div className="inline-block mb-3 px-3 py-1 rounded-full bg-pink-500/20 text-pink-400 text-[11px] font-medium tracking-widest uppercase border border-pink-500/30">
                    {subscriptionDuration === '1_week' ? '1-Week Access Active' : '1-Month Access Active'}
                  </div>
                  <h3 className="font-light tracking-wide text-white/90 text-xl mb-2">Premium Unlocked</h3>
                  <p className="text-sm font-light text-white/60 max-w-md mx-auto mb-4">
                    You have full unlimited access to all coaching modules and infinite practice time.
                  </p>

                  {premiumExpiresAt && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/50 border border-pink-500/30 text-xs text-pink-300 font-mono mb-4">
                      <Calendar className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                      <span>Expires on {new Date(premiumExpiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      <span className="text-pink-500/60">•</span>
                      <span className="text-white/80">{Math.max(0, Math.ceil((new Date(premiumExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining</span>
                    </div>
                  )}

                  {paymentError && (
                    <div className="my-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-left max-w-md mx-auto">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                      <p className="text-xs text-red-200">{paymentError}</p>
                    </div>
                  )}

                  {/* Cancel Subscription Action & Confirmation */}
                  <div className="mt-4 pt-5 border-t border-white/10 max-w-md mx-auto">
                    {!showCancelConfirm ? (
                      <button
                        id="cancel-subscription-init-button"
                        type="button"
                        onClick={() => setShowCancelConfirm(true)}
                        className="text-xs text-white/40 hover:text-red-400 transition-colors underline underline-offset-4 tracking-wide flex items-center justify-center gap-1.5 mx-auto py-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel ongoing subscription</span>
                      </button>
                    ) : (
                      <div className="p-4 rounded-xl bg-black/70 border border-red-500/40 text-left">
                        <div className="flex items-start gap-3 mb-3">
                          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Cancel Ongoing Subscription?</h4>
                            <p className="text-xs text-white/60 mt-1 leading-relaxed">
                              Are you sure you want to cancel your ongoing subscription? Premium access will be deactivated and your daily allowance will return to the free limit of 5 minutes.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2.5 mt-4">
                          <button
                            id="cancel-subscription-abort-button"
                            type="button"
                            onClick={() => setShowCancelConfirm(false)}
                            disabled={isCancellingSubscription}
                            className="px-3 py-1.5 rounded-lg text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            Keep Subscription
                          </button>
                          <button
                            id="cancel-subscription-confirm-button"
                            type="button"
                            onClick={handleCancelSubscription}
                            disabled={isCancellingSubscription}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                          >
                            {isCancellingSubscription ? 'Cancelling...' : 'Yes, Cancel Subscription'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
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

                  {/* 1-Week Plan Card (Shown ABOVE the 1-Month Plan) */}
                  <div className="rounded-2xl p-8 border backdrop-blur-sm mb-6 text-center transition-all bg-white/5 border-pink-500/30 relative overflow-hidden shadow-[0_0_25px_rgba(236,72,153,0.08)]">
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 rounded-full bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                        <Sparkles className="w-6 h-6 text-pink-400" />
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-3">
                      <span className="px-3 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[10px] font-semibold tracking-widest uppercase">
                        1 Week Plan
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-pink-500 text-black text-[10px] font-extrabold tracking-wider uppercase shadow-[0_0_10px_rgba(236,72,153,0.3)]">
                        67% OFF
                      </span>
                    </div>

                    {/* Price Display with Strikethrough for Rs. 300 */}
                    <div className="flex items-center justify-center gap-2.5 mb-1">
                      <span className="text-xl text-white/40 line-through font-light decoration-pink-500 decoration-2">
                        ₹300
                      </span>
                      <h3 className="font-light tracking-wide text-white/90 text-3xl">
                        ₹100
                      </h3>
                      <span className="text-sm text-white/40 font-normal">/ 1 week</span>
                    </div>

                    <p className="text-xs font-light text-pink-400/90 mb-4 tracking-wide">
                      Special introductory offer • Save 67% • 7-day all-inclusive pass
                    </p>

                    <p className="text-sm font-light text-white/60 mb-6 px-4 max-w-md mx-auto">
                      Get full access to Veronica AI for 1 week with unlimited voice conversation time, all coaching modes, and personalized feedback.
                    </p>

                    {/* Features list */}
                    <div className="max-w-md mx-auto mb-6 text-left space-y-2.5 bg-black/40 p-4 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2.5 text-xs font-light text-white/80">
                        <Clock className="w-4 h-4 text-pink-400 shrink-0" />
                        <span><strong>1-Week Duration:</strong> Full access active for 7 calendar days</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs font-light text-white/80">
                        <CircleCheck className="w-4 h-4 text-pink-400 shrink-0" />
                        <span><strong>Unlimited Voice Practice:</strong> No 5-minute daily limits</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs font-light text-white/80">
                        <CircleCheck className="w-4 h-4 text-pink-400 shrink-0" />
                        <span><strong>All Modules:</strong> Complete access to all conversation scenarios</span>
                      </div>
                    </div>

                    <button 
                      id="razorpay-checkout-week-button"
                      onClick={() => handlePayment('1_week')} 
                      disabled={isPaymentLoading}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-pink-500 hover:bg-pink-400 text-black text-sm font-semibold transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                    >
                      {isPaymentLoading && loadingPlan === '1_week' ? 'Processing Checkout...' : 'Upgrade for 1 Week - ₹100'}
                    </button>
                    <p className="text-[11px] text-white/40 mt-3 font-light">
                      Special offer: ₹100 (Was ₹300, 67% off) • Valid for 7 days
                    </p>
                  </div>

                  {/* Premium 1-Month Subscription Card */}
                  <div className="rounded-2xl p-8 border backdrop-blur-sm mb-6 text-center transition-all bg-white/5 border-pink-500/30 relative overflow-hidden shadow-[0_0_25px_rgba(236,72,153,0.08)]">
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 rounded-full bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                        <Sparkles className="w-6 h-6 text-pink-400" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <span className="px-3 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[10px] font-semibold tracking-widest uppercase">
                        1 Month Plan
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-pink-500 text-black text-[10px] font-extrabold tracking-wider uppercase shadow-[0_0_10px_rgba(236,72,153,0.3)]">
                        58% OFF
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-2.5 mb-1">
                      <span className="text-xl text-white/40 line-through font-light decoration-pink-500 decoration-2">
                        ₹1,200
                      </span>
                      <h3 className="font-light tracking-wide text-white/90 text-3xl">
                        ₹500
                      </h3>
                      <span className="text-sm text-white/40 font-normal">/ 1 month</span>
                    </div>

                    <p className="text-xs font-light text-pink-400/90 mb-4 tracking-wide">
                      Special offer • Save 58% (Was ₹1,200) • 30-day all-inclusive pass
                    </p>
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

                    <button 
                      id="razorpay-checkout-month-button"
                      onClick={() => handlePayment('1_month')} 
                      disabled={isPaymentLoading}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-pink-500 hover:bg-pink-400 text-black text-sm font-semibold transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                    >
                      {isPaymentLoading && loadingPlan === '1_month' ? 'Processing Checkout...' : 'Upgrade for 1 Month - ₹500'}
                    </button>
                    <p className="text-[11px] text-white/40 mt-3 font-light">
                      Special offer: ₹500 (Was ₹1,200, 58% off) • Valid for 30 days
                    </p>
                  </div>
                </>
              )}

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
                          if (promoCode === 'VERONICA_PRO') {
                            const oneMonthLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                            setIsPremium(true);
                            setPremiumExpiresAt(oneMonthLater);
                            setSubscriptionDuration('1_month');
                            setPromoCode('');
                            setPromoError('');
                            setPaymentSuccess('Promo code applied! Temporary Premium Pass activated for this session.');
                            sessionStorage.setItem('tempPremium', 'true');
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
      <nav className="bg-[#050505]/80 backdrop-blur-xl border-t border-white/5 absolute bottom-0 w-full z-20 pb-env">
        <div className="flex justify-center items-center gap-2 max-w-md mx-auto p-4 w-full">
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
      </div>

      
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

      {/* Feedback Locked Modal for Free Users after Call Terminates */}
      <AnimatePresence>
        {showFeedbackLockedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0e0e0e] border border-white/15 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl relative"
            >
              <button 
                onClick={() => setShowFeedbackLockedModal(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mx-auto mb-4 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                <Lock className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-light text-white mb-1">Conversation Ended</h3>
              <p className="text-[10px] uppercase tracking-widest text-pink-400 font-semibold mb-3">
                🔒 Feedback & Scoring is Locked
              </p>

              <p className="text-xs font-light text-white/70 leading-relaxed mb-6">
                You completed your practice call! To analyze your conversation, extract the 5 main parameters, calculate your objective score, and get your strengths and weaknesses breakdown, unlock Premium.
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setShowFeedbackLockedModal(false);
                    setActiveTab('pricing');
                  }}
                  className="w-full py-3 rounded-full bg-pink-500 hover:bg-pink-400 text-black text-xs font-semibold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                >
                  Unlock Premium Feedback
                </button>
                <button
                  onClick={() => setShowFeedbackLockedModal(false)}
                  className="w-full py-2 rounded-full bg-transparent hover:bg-white/5 text-white/40 hover:text-white/80 text-xs tracking-wider transition-all"
                >
                  Continue Free
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
