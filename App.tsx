
import React, { useState, useEffect, useCallback, useRef } from 'react';
// Fix: 'LiveConnection' is not an exported member of '@google/genai'.
import { Modality } from '@google/genai';
import type { Message, FileData, ChatSession, UserProfile, User, Source } from './types';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import { VideoIcon, VideoOffIcon, MicrophoneIcon, MicrophoneOffIcon, LogoutIcon, MenuIcon, UserIcon } from './components/Icons';
import { tr } from './locales/tr';
import AuthScreen from './components/AuthScreen';
import ChatHistorySidebar from './components/ChatHistorySidebar';
import ProfileModal from './components/ProfileModal';
import CookieConsentBanner from './components/CookieConsentBanner';
import VideoCallOverlay from './components/VideoCallOverlay';


// Fix: Add missing Web Speech API type definitions to resolve compilation errors.
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    // Fix: Add webkitAudioContext to window type definition for cross-browser compatibility.
    webkitAudioContext: typeof AudioContext;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  // Fix: Add missing property 'resultIndex' to SpeechRecognitionEvent interface to resolve TypeScript error.
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult;
  readonly length: number;
}

interface SpeechRecognitionResult {
  readonly [index: number]: SpeechRecognitionAlternative;
  readonly length: number;
  // Fix: Add missing property 'isFinal' to SpeechRecognitionResult interface to resolve TypeScript error.
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

// --- Helper Functions ---
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = (reader.result as string).split(',')[1];
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
  });

const FRAME_RATE = 1; // 1 frame per second
const JPEG_QUALITY = 0.7;

// --- Main App Component ---
const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // User Auth State
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'email' | 'code'>('email');
  const [verifyingEmail, setVerifyingEmail] = useState('');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const verificationCodeRef = useRef<string | null>(null);
  const [showCookieConsent, setShowCookieConsent] = useState(false);


  // Chat History State
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Video Call State
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [aiVolume, setAiVolume] = useState<number>(1);
  const [liveUserTranscript, setLiveUserTranscript] = useState<string>('');
  const [liveAiTranscript, setLiveAiTranscript] = useState<string>('');
  const [userMicLevel, setUserMicLevel] = useState<number>(0);


  // Voice Command State
  const [isVoiceCommandEnabled, setIsVoiceCommandEnabled] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const videoCallRecognitionRef = useRef<SpeechRecognition | null>(null);
  
  
  // Initialize user session on component mount
  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
        setShowCookieConsent(true);
    }
    // Check for logged in user
    const loggedInUser = localStorage.getItem('currentUserEmail');
    if (loggedInUser) {
      handleFinalizeLogin(loggedInUser);
    }
  }, []);
  
  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Save the entire user object to localStorage whenever their profile or chat history changes
  useEffect(() => {
    if (currentUserEmail && (chatHistory.length > 0 || currentUserProfile)) {
        try {
            const dbString = localStorage.getItem('td_ai_users_db') || '{}';
            const db = JSON.parse(dbString);
            const user = db[currentUserEmail];

            if (user) {
                user.chatHistory = chatHistory;
                if (currentUserProfile) {
                    user.profile = currentUserProfile;
                }
                localStorage.setItem('td_ai_users_db', JSON.stringify(db));
            }
        } catch (e) {
            console.error("Failed to save user data:", e);
        }
    }
  }, [chatHistory, currentUserProfile, currentUserEmail]);

  
  // When active chat changes, update the displayed messages
  useEffect(() => {
    if (activeChatId) {
        const activeChat = chatHistory.find(c => c.id === activeChatId);
        setMessages(activeChat?.messages || []);
    } else {
        // This is a new chat, start with a welcome message
        const welcomeMessages = tr.welcomeMessages;
        const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        setMessages([{ role: 'model', text: randomMessage }]);
    }
  }, [activeChatId, chatHistory]);

  const handleAcceptCookies = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setShowCookieConsent(false);
  };

  const handleDeclineCookies = () => {
      localStorage.setItem('cookieConsent', 'declined');
      setShowCookieConsent(false);
  };

  const handleRequestCode = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    
    // In a real app, you would call your backend to send an email.
    // Here, we simulate it by generating a code and showing it on the UI.
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodeRef.current = code;
    setSimulatedCode(code);

    setVerifyingEmail(normalizedEmail);
    setAuthStep('code');
    setVerificationError(null);
  };

  const handleVerifyCode = (code: string) => {
    if (code === verificationCodeRef.current) {
      setVerificationError(null);
      handleFinalizeLogin(verifyingEmail);
    } else {
      setVerificationError(tr.auth.invalidCodeError);
    }
  };

  const handleChangeEmail = () => {
    setAuthStep('email');
    setVerifyingEmail('');
    verificationCodeRef.current = null;
    setVerificationError(null);
    setSimulatedCode(null);
  };
  
  const handleFinalizeLogin = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    localStorage.setItem('currentUserEmail', normalizedEmail);

    try {
        const dbString = localStorage.getItem('td_ai_users_db') || '{}';
        const db = JSON.parse(dbString);
        let user: User = db[normalizedEmail];

        const now = new Date().toISOString();

        if (!user) {
            // New user registration
            user = {
                email: normalizedEmail,
                profile: {
                    name: normalizedEmail.split('@')[0],
                    avatar: null
                },
                chatHistory: [],
                activity: {
                    createdAt: now,
                    lastLogin: now,
                }
            };
        } else {
            // Existing user login
            user.activity.lastLogin = now;
        }

        db[normalizedEmail] = user;
        localStorage.setItem('td_ai_users_db', JSON.stringify(db));

        // Set state from the loaded/created user object
        setCurrentUserEmail(user.email);
        setCurrentUserProfile(user.profile);
        setChatHistory(user.chatHistory);

        if (user.chatHistory.length > 0) {
            // Activate the most recent chat
            setActiveChatId(user.chatHistory[0].id);
        } else {
            // New user, start a new chat session
            handleNewChat();
        }

    } catch (e) {
        console.error("Failed to load or create user data:", e);
        // Fallback for corrupted data
        const profile = { name: normalizedEmail.split('@')[0], avatar: null };
        setCurrentUserEmail(normalizedEmail);
        setCurrentUserProfile(profile);
        handleNewChat();
    }
  };
  
  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setIsSidebarOpen(false);
  }, []);

  const handleSelectChat = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    setIsSidebarOpen(false);
  }, []);

  const handleDeleteChat = useCallback((chatId: string) => {
    if (window.confirm(tr.chatHistory.deleteConfirm)) {
      setChatHistory(prev => prev.filter(chat => chat.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
    }
  }, [activeChatId]);

  const handleSaveProfile = (name: string, avatar: string | null) => {
    if (!currentUserEmail) return;
    const updatedProfile = { name, avatar };
    setCurrentUserProfile(updatedProfile);
    setIsProfileModalOpen(false);
    // The useEffect will handle saving this to the main DB
  };


  const handleLogout = useCallback(() => {
    localStorage.removeItem('currentUserEmail');
    setCurrentUserEmail(null);
    setCurrentUserProfile(null);
    setMessages([]);
    setChatHistory([]);
    setActiveChatId(null);
    setIsProfileMenuOpen(false);
    setAuthStep('email');
    setVerifyingEmail('');
    setSimulatedCode(null);
  }, []);

  const toggleVoiceCommands = useCallback(() => {
    setIsVoiceCommandEnabled(prev => !prev);
  }, []);

  const stopVideoCall = useCallback(() => {
    setIsConnecting(false);
    setIsCallActive(false);

    videoCallRecognitionRef.current?.stop();
    window.speechSynthesis?.cancel();

    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    
    analyserRef.current = null;
    
    const callEndMessage = { role: 'model' as const, text: "Görüntülü görüşme bitti." };
    if(activeChatId) {
       setChatHistory(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, callEndMessage] } : c));
    }

  }, [localStream, activeChatId]);

  const startVideoCall = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: {
                sampleRate: 16000,
                channelCount: 1,
            },
        });
        setLocalStream(stream);
        setIsConnecting(false);
        setIsCallActive(true);

        const callStartMessage = { role: 'model' as const, text: "Görüntülü görüşme başladı! "};
        if (activeChatId) {
            setChatHistory(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, callStartMessage] } : c));
        } else {
            const newChatId = Date.now().toString();
            const newChatSession: ChatSession = { id: newChatId, title: "Video Call", messages: [...messages, callStartMessage] };
            setChatHistory(prev => [newChatSession, ...prev]);
            setActiveChatId(newChatId);
        }

        // Setup mic visualization
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Setup Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'tr-TR';
            
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = '';
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                setLiveUserTranscript(finalTranscript + interimTranscript);
                
                if (finalTranscript) {
                    setLiveUserTranscript(finalTranscript);
                    // Simulate AI echo response
                    const aiResponse = `Anladım, '${finalTranscript.trim()}' dedin. Sana nasıl yardımcı olabilirim?`;
                    setLiveAiTranscript(aiResponse);
                    
                    const utterance = new SpeechSynthesisUtterance(aiResponse);
                    utterance.lang = 'tr-TR';
                    utterance.volume = aiVolume;
                    utterance.onstart = () => setIsAiSpeaking(true);
                    utterance.onend = () => {
                        setIsAiSpeaking(false);
                        // Clear transcripts for next turn
                        setTimeout(() => {
                           setLiveUserTranscript('');
                           setLiveAiTranscript('');
                        }, 2000);
                    };
                    window.speechSynthesis.speak(utterance);
                }
            };
            
            recognition.onend = () => {
                if (isCallActive) recognition.start(); // Restart if call is still active
            };

            recognition.onerror = (e) => console.error("Video call recognition error:", e);

            if (!isMuted) recognition.start();
            videoCallRecognitionRef.current = recognition;
        }

    } catch (e: any) {
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            setError(tr.videoCall.mediaAccessError);
        } else {
            setError(`${tr.videoCall.mediaAccessErrorTechnical}${e.message}`);
        }
        console.error(e);
        stopVideoCall();
    }
  }, [activeChatId, messages, isMuted, stopVideoCall, aiVolume, isCallActive]);

  const toggleMute = useCallback(() => {
    const nextMutedState = !isMuted;
    setIsMuted(nextMutedState);
    if(videoCallRecognitionRef.current){
        if(nextMutedState){
            videoCallRecognitionRef.current.stop();
        } else {
            videoCallRecognitionRef.current.start();
        }
    }
  }, [isMuted]);
  
  useEffect(() => {
    // Attach stream to video element when it becomes available
    if (isCallActive && localStream && videoRef.current) {
        videoRef.current.srcObject = localStream;
    }
  }, [localStream, isCallActive]);
  
  // Effect for mic level visualization
  useEffect(() => {
    if (!isCallActive || !analyserRef.current) {
        setUserMicLevel(0);
        return;
    }

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrameId: number;

    const updateMicLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        const normalized = Math.min(1, (average / 128) * 1.5);
        setUserMicLevel(normalized);
        animationFrameId = requestAnimationFrame(updateMicLevel);
    };

    updateMicLevel();

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [isCallActive]);


  // Effect for handling voice commands
  useEffect(() => {
    // Fix: Use type-safe access to window.SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported by this browser.");
      return;
    }

    if (!recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.lang = 'tr-TR';
        recognition.interimResults = false;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const last = event.results.length - 1;
            const command = event.results[last][0].transcript.toLowerCase().trim();
            
            console.log("Heard command:", command);

            if (command.includes(tr.app.startCallCommand)) {
                if (!isCallActive && !isConnecting) {
                    startVideoCall();
                }
            } else if (command.includes(tr.app.endCallCommand)) {
                if (isCallActive) {
                    stopVideoCall();
                }
            }
        };
        
        recognition.onend = () => {
            if (isVoiceCommandEnabled && !isCallActive && !isConnecting) {
                try {
                   recognition.start();
                } catch (e) {
                   console.error("Error restarting speech recognition:", e);
                }
            }
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
             console.error("Speech recognition error:", event.error);
        };

        recognitionRef.current = recognition;
    }
    
    const recognition = recognitionRef.current;
    
    try {
        if (isVoiceCommandEnabled && !isCallActive && !isConnecting) {
            recognition.start();
        } else {
            recognition.stop();
        }
    } catch (e: any) {
        if (e.name !== 'InvalidStateError') {
             console.error("Could not start/stop speech recognition:", e);
        }
    }
    
    return () => {
      recognition?.stop();
    };
  }, [isCallActive, isConnecting, isVoiceCommandEnabled, startVideoCall, stopVideoCall]);
  
  const handleSendMessage = useCallback(async (prompt: string, file?: File | null) => {
    setIsLoading(true);
    setError(null);
    
    let fileData: FileData | undefined = undefined;
    if (file) {
        try {
            const base64 = await fileToBase64(file);
            fileData = { base64, mimeType: file.type };
        } catch (e) {
            console.error(e);
            setError(tr.common.fileProcessError);
            setIsLoading(false);
            return;
        }
    }

    const userMessage: Message = { role: 'user', text: prompt, file: fileData };
    
    const isNewChat = !activeChatId;
    let currentChatId = activeChatId;

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    if (isNewChat) {
        const newChatId = Date.now().toString();
        currentChatId = newChatId;
        
        const newChatSession: ChatSession = {
            id: newChatId,
            title: prompt.substring(0, 30) + '...',
            messages: updatedMessages,
        };
        
        setChatHistory(prev => [newChatSession, ...prev]);
        setActiveChatId(newChatId);
    } else {
        setChatHistory(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: updatedMessages } : c));
    }

    // Simulate AI response
    setTimeout(() => {
        const randomResponse = tr.welcomeMessages[Math.floor(Math.random() * tr.welcomeMessages.length)];
        const simulatedText = `(Simülasyon Modu) ${randomResponse}`;
        
        const finalModelMessage: Message = { role: 'model', text: simulatedText };
        
        setMessages(prev => [...updatedMessages, finalModelMessage]);
        setChatHistory(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: [...updatedMessages, finalModelMessage] } : c));
        setIsLoading(false);
    }, 1200 + Math.random() * 800);

  }, [messages, activeChatId, chatHistory]);

  // Effect to handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;

        // Escape to close modals or sidebar
        if (e.key === 'Escape') {
            if (isProfileModalOpen) {
                e.preventDefault();
                setIsProfileModalOpen(false);
                return;
            }
            if (isSidebarOpen) {
                e.preventDefault();
                setIsSidebarOpen(false);
                return;
            }
        }
        
        // Prevent global shortcuts when profile modal is open
        if (isProfileModalOpen) {
            return;
        }

        // Toggle Sidebar: Ctrl + B (but not when typing)
        if (isCtrlOrCmd && e.key.toLowerCase() === 'b' && !isInputFocused) {
            e.preventDefault();
            setIsSidebarOpen(prev => !prev);
        }

        // New Chat: Ctrl + Shift + N
        if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            handleNewChat();
        }

        // Toggle Video Call: Ctrl + K
        if (isCtrlOrCmd && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (!isConnecting) {
                isCallActive ? stopVideoCall() : startVideoCall();
            }
        }
        
        // Toggle Voice Commands: Ctrl + Shift + L
        if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            toggleVoiceCommands();
        }

        // Toggle Mute: Ctrl + D (only during call)
        if (isCtrlOrCmd && e.key.toLowerCase() === 'd' && isCallActive) {
            e.preventDefault();
            toggleMute();
        }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCallActive, isConnecting, isProfileModalOpen, isSidebarOpen, handleNewChat, stopVideoCall, startVideoCall, toggleVoiceCommands, toggleMute]);


  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setAiVolume(newVolume);
  };


  return (
    <>
      {showCookieConsent ? (
        <CookieConsentBanner onAccept={handleAcceptCookies} onDecline={handleDeclineCookies} />
      ) : !currentUserEmail ? (
        <AuthScreen
            authStep={authStep}
            verifyingEmail={verifyingEmail}
            onRequestCode={handleRequestCode}
            onChangeEmail={handleChangeEmail}
            onVerifyCode={handleVerifyCode}
            error={verificationError}
            simulatedCode={simulatedCode}
        />
      ) : (
        <>
          <div className="flex h-screen text-white font-sans">
            <ChatHistorySidebar 
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              chatHistory={chatHistory}
              activeChatId={activeChatId}
              onNewChat={handleNewChat}
              onSelectChat={handleSelectChat}
              onDeleteChat={handleDeleteChat}
            />
            
            <ProfileModal 
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                onSave={handleSaveProfile}
                currentName={currentUserProfile?.name || ''}
                currentAvatar={currentUserProfile?.avatar || null}
            />

            <main className="flex-1 flex flex-col bg-gray-900 relative">
              {/* Header */}
              <header className="flex items-center justify-between p-4 border-b border-gray-800 absolute top-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-gray-400 hover:text-white lg:hidden" title={tr.chatHistory.toggleSidebarShortcut}>
                      <MenuIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold tracking-wider text-red-500">Td AI</h1>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
                    <span className={`w-2 h-2 rounded-full ${isVoiceCommandEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
                    <span>{isVoiceCommandEnabled ? tr.app.listening : tr.app.voiceCommandsOff}</span>
                  </div>
                  <button onClick={toggleVoiceCommands} className="text-gray-400 hover:text-white" title={isVoiceCommandEnabled ? tr.app.disableVoiceCommandsShortcut : tr.app.enableVoiceCommandsShortcut} aria-label={isVoiceCommandEnabled ? tr.app.disableVoiceCommands : tr.app.enableVoiceCommands}>
                      {isVoiceCommandEnabled ? <MicrophoneIcon className="w-5 h-5" /> : <MicrophoneOffIcon className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={isCallActive ? stopVideoCall : startVideoCall}
                    disabled={isConnecting}
                    className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
                    title={isCallActive ? tr.videoCall.endShortcut : tr.videoCall.startShortcut}
                    aria-label={isCallActive ? tr.videoCall.end : tr.videoCall.start}
                  >
                    {isConnecting ? (
                      <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    ) : isCallActive ? (
                      <VideoOffIcon className="w-5 h-5 text-red-400" />
                    ) : (
                      <VideoIcon className="w-5 h-5" />
                    )}
                  </button>

                  {currentUserProfile && (
                    <div className="relative">
                      <button onClick={() => setIsProfileMenuOpen(prev => !prev)} className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
                            {currentUserProfile.avatar ? (
                              <img src={`data:image/png;base64,${currentUserProfile.avatar}`} alt="User Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <span className="hidden sm:inline text-sm font-medium">{currentUserProfile.name}</span>
                      </button>
                      {isProfileMenuOpen && (
                        <div ref={profileMenuRef} className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg z-20 overflow-hidden animate-[fade-in_0.1s_ease-out]">
                          <button onClick={() => { setIsProfileModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-red-600">
                            {tr.profile.edit}
                          </button>
                          <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-red-600 flex items-center gap-2">
                            <LogoutIcon className="w-4 h-4" />
                            {tr.auth.logout}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </header>
              
              <div className="flex-1 flex flex-col pt-20"> {/* pt-20 for header height */}
                {isCallActive ? (
                  <VideoCallOverlay
                    isAiSpeaking={isAiSpeaking}
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    currentUserProfile={currentUserProfile}
                    isMuted={isMuted}
                    aiVolume={aiVolume}
                    userMicLevel={userMicLevel}
                    liveUserTranscript={liveUserTranscript}
                    liveAiTranscript={liveAiTranscript}
                    toggleMute={toggleMute}
                    handleVolumeChange={handleVolumeChange}
                    stopVideoCall={stopVideoCall}
                  />
                ) : (
                    <div className="flex-1 flex flex-col justify-end min-h-0">
                        <ChatWindow messages={messages} isLoading={isLoading} userAvatar={currentUserProfile?.avatar || null} />
                    </div>
                )}
                
                <div className={`p-4 md:p-6 w-full max-w-4xl mx-auto ${isCallActive ? 'absolute bottom-0 left-0 right-0' : ''}`}>
                  {error && <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                    isCallActive={isCallActive}
                    placeholder={isCallActive ? tr.videoCall.activePlaceholder : tr.chat.placeholder}
                    attachFileLabel={tr.chat.attachFile}
                    removeFileLabel={tr.chat.removeFile}
                  />
                </div>
              </div>
            </main>
          </div>
          <style>{`
            /* Custom scrollbar for webkit browsers */
            .overflow-y-auto::-webkit-scrollbar {
              width: 8px;
            }
            .overflow-y-auto::-webkit-scrollbar-track {
              background: transparent;
            }
            .overflow-y-auto::-webkit-scrollbar-thumb {
              background-color: rgba(139, 0, 0, 0.5); /* Darker red */
              border-radius: 20px;
              border: 3px solid transparent;
              background-clip: content-box;
            }
            .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                background-color: rgba(185, 28, 28, 0.7); /* Red-700 */
            }
            /* Custom styles for volume slider */
            input[type=range] { -webkit-appearance: none; background: transparent; }
            input[type=range]::-webkit-slider-runnable-track { height: 4px; background: #4b5563; border-radius: 2px; }
            input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; margin-top: -6px; width: 16px; height: 16px; background: #fff; border-radius: 50%; border: 1px solid #ddd; cursor: pointer; }
            input[type=range]::-moz-range-track { height: 4px; background: #4b5563; border-radius: 2px; }
            input[type=range]::-moz-range-thumb { width: 16px; height: 16px; background: #fff; border-radius: 50%; border: 1px solid #ddd; cursor: pointer; }
            
            @keyframes fade-in {
                from { opacity: 0; transform: scale(0.98); }
                to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </>
      )}
    </>
  );
};

export default App;
