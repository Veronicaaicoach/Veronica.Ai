const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');

const targetRegex = /const fallbackPrompt = \`You are Veronica AI.+?contents: fallbackPrompt,/s;
const replacement = `const combinedAudioBuffer = Buffer.concat(userAudioChunks.map(chunk => Buffer.from(chunk, 'base64')));
                      const combinedAudioBase64 = combinedAudioBuffer.toString('base64');
                      const fallbackPrompt = \`You are Veronica AI, Dating & Social Confidence Coach. The user just completed a voice practice session for module "\${moduleName}". I have attached the audio of the user's side of the conversation. Listen to the conversation, analyze their performance, extract the 5 main parameters (Conversation Flow & Rhythm, Active Listening & Reciprocity, Confidence & Composure, Engagement & Question Quality, Emotional Awareness & Calibration) with individual 0-100 scores and observations, calculate an overall score from 0 to 100 based on these parameters, detail concrete Strengths and Weaknesses of the conversation, give 2-3 better response examples with reasons, and specify an actionable practice focus.\`;
                      
                      const reqContents = userAudioChunks.length > 0 ? [
                        { role: 'user', parts: [
                          { inlineData: { mimeType: "audio/pcm;rate=16000", data: combinedAudioBase64 } },
                          { text: fallbackPrompt }
                        ]}
                      ] : fallbackPrompt;

                      const fallbackResponse = await ai.models.generateContent({
                        model: 'gemini-3.1-flash-preview',
                        contents: reqContents as any,`;

if (targetRegex.test(code)) {
  fs.writeFileSync('server.ts', code.replace(targetRegex, replacement));
  console.log("Success");
} else {
  console.log("Target not found");
}
