const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Update stopCall
const oldStopCall = `
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
        setCallState('analyzing');`;

const newStopCall = `
    // Free users OR Dating Advice module: skip feedback analysis
    if (!isPremium || personality === 'Dating advice') {
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
      if (!skipFeedback && personality !== 'Dating advice') {
        setShowFeedbackLockedModal(true);
      }
      return;
    }

    // Premium users (excluding Dating Advice): trigger comprehensive analysis and feedback generation
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (skipFeedback) {
        wsRef.current.close();
        setCallState('idle');
      } else {
        const userSpoke = maxVolRef.current > 0.12;
        setCallState('analyzing');`;

code = code.replace(oldStopCall, newStopCall);

// Update Feedback View
const oldFeedbackView = `
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col p-6 w-full max-w-4xl mx-auto pb-32"
            >
              <div className="mb-8">
                <span className="text-sm font-medium tracking-[0.3em] uppercase">Post-Call <span className="text-pink-500">Analysis</span></span>
              </div>

              {!isPremium ? (
                /* Free Tier Upsell View */
                <div className="flex flex-col items-center justify-center py-20 text-center">`;
                
const newFeedbackView = `
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col p-6 w-full max-w-4xl mx-auto pb-32"
            >
              <div className="mb-8">
                <span className="text-sm font-medium tracking-[0.3em] uppercase">Post-Call <span className="text-pink-500">Analysis</span></span>
              </div>

              {personality === 'Dating advice' ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(236,72,153,0.1)]">
                    <Info className="w-10 h-10 text-pink-400" />
                  </div>
                  <h3 className="text-2xl font-light text-white mb-3">No Feedback Required</h3>
                  <p className="text-sm font-light text-white/50 max-w-md mx-auto leading-relaxed">
                    The Dating Advice module is an open Q&A format. Since this isn't a simulated roleplay, your performance (calibration, flow, etc.) is not evaluated here. 
                  </p>
                </div>
              ) : !isPremium ? (
                /* Free Tier Upsell View */
                <div className="flex flex-col items-center justify-center py-20 text-center">`;

code = code.replace(oldFeedbackView, newFeedbackView);

fs.writeFileSync('src/App.tsx', code);
console.log("Success");
