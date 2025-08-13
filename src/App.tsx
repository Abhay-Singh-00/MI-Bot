import { useState } from "react";
import "./App.css";

// Type for a conversation message
interface Message {
  role: "user" | "model";
  text: string;
}

// Extend window for SpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition;
    SpeechRecognition?: typeof SpeechRecognition;
  }
}

function App() {
  const [conversation, setConversation] = useState<Message[]>([]);
  const [userText, setUserText] = useState<string>("");
  const [aiText, setAiText] = useState<string>("");
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isInterviewActive, setIsInterviewActive] = useState<boolean>(false);

  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  let recognition: SpeechRecognition | undefined;

  if (typeof window !== "undefined") {
    if ("webkitSpeechRecognition" in window && window.webkitSpeechRecognition) {
      recognition = new window.webkitSpeechRecognition();
    } else if ("SpeechRecognition" in window && window.SpeechRecognition) {
      recognition = new window.SpeechRecognition();
    }

    if (recognition) {
      recognition.lang = "en-US";
      recognition.interimResults = false;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const text = event.results[0][0].transcript;
        setUserText(text);
        stopListening();
        sendToGemini(text);
      };

      recognition.onend = () => {
        // No auto restart — AI will decide when to listen again
      };
    }
  }

  const startListening = () => {
    if (recognition && !isProcessing && isInterviewActive) recognition.start();
  };

  const stopListening = () => {
    recognition?.stop();
  };

  function speak(text: string) {
    if (!isInterviewActive) return;
    stopListening();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.onend = () => {
      if (isInterviewActive && questionCount < 5) {
        setTimeout(() => {
          startListening();
        }, 800);
      }
    };
    speechSynthesis.speak(utterance);
  }

  async function sendToGemini(message: string) {
    if (isProcessing || !isInterviewActive) return;
    setIsProcessing(true);

    const updatedConversation: Message[] = [
      ...conversation,
      { role: "user", text: message },
    ];

    const systemPrompt = `
You are an AI interviewer.
- Ask one unique question at a time.
- Never repeat a previous question from this conversation.
- After each answer, respond with a short acknowledgment, then the next question.
- Stop after 5 total questions and thank the candidate politely.
`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: systemPrompt }] },
              ...updatedConversation.map((msg) => ({
                role: msg.role,
                parts: [{ text: msg.text }],
              })),
            ],
          }),
        }
      );

      const data = await res.json();
      const aiReply: string =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't understand.";

      setConversation([
        ...updatedConversation,
        { role: "model", text: aiReply },
      ]);
      setAiText(aiReply);

      setQuestionCount((prev) => prev + 1);
      speak(aiReply);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsProcessing(false);
    }
  }

  function startInterview() {
    setIsInterviewActive(true);
    setConversation([]);
    setQuestionCount(1);
    const firstQuestion =
      "Hello! Let's start the interview. Tell me about yourself.";
    setAiText(firstQuestion);
    speak(firstQuestion);
  }

  function stopInterview() {
    setIsInterviewActive(false);
    setQuestionCount(5);
    stopListening();
    speechSynthesis.cancel();
    setAiText("Interview ended. Thank you!");
  }

  return (
    <>
      <h1 className="text-6xl bg-blue-600 text-center text-yellow-500 font-bold drop-shadow-lg">
        🎤 AI Based Mock Interview
      </h1>
      <div className="relative flex flex-col items-center justify-center min-h-screen text-white p-6 overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center filter opacity-94 scale-105"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1727434032773-af3cd98375ba?w=1600&auto=format&fit=crop&q=80')",
          }}
        ></div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-lg">
          <p className="mb-12 text-gray-200 font-bold text-3xl drop-shadow-lg">
            Practice your interview skills with AI. Click below to start.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={startInterview}
              className="h-30 w-30 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-full font-semibold shadow-lg transition duration-200"
            >
              Start Interview
            </button>
            <button
              onClick={stopInterview}
              className="h-30 w-30 px-6 py-3 bg-red-500 hover:bg-red-600 rounded-full font-semibold shadow-lg transition duration-200"
            >
              Stop
            </button>
          </div>

          {userText && (
            <p className="mt-4 text-yellow-400 bg-white">
              🗣 You: {userText}
            </p>
          )}
          {aiText && (
            <p className="mt-4 text-green-400 bg-white">
              🤖 AI: {aiText}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
