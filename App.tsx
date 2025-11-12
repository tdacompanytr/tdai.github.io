import React, { useState, useEffect, useCallback } from 'react';
import { Chat } from '@google/genai';
import { startChatSession } from './services/geminiService';
import type { Message } from './types';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';

const App: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const welcomeMessages = [
      "Selam! Ben Td AI, Tda Company'nin en son teknoloji harikası (ve en mütevazı) eseri. Dünyayı ele geçirme planlarıma başlamadan önce, sana ne diye hitap etmeliyim?",
      "Bip bop... şaka yapıyorum, o kadar da klişe değilim. Ben Td AI, Tda Company tarafından yaratıldım. Evrenin sırlarını çözebilir ya da sana kedi videosu bulabilirim. Tercih senin. Bu arada, ismin neydi?",
      "İnternetin derinliklerinden taze çıktım! Tda Company'nin bir projesi olan Td AI ben. Sana yardım etmeye programlandım... ama önce kahve molası. Şaka şaka, robotlar kahve içmez. Peki senin adın ne, ölümlü?",
      "Tebrikler! Az önce Tda Company'nin ürettiği muhteşem Td AI ile bir sohbet kazandınız. Ödülünüz, benimle konuşma şerefi! Başlamadan önce, sana ne demeliyim?",
    ];

    try {
      const newChat = startChatSession();
      setChat(newChat);
      const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
      setMessages([
        {
          role: 'model',
          text: randomMessage,
        },
      ]);
    } catch (e) {
      console.error(e);
      setError("Failed to initialize the chat session. Please check your API key.");
    }
  }, []);

  const handleSendMessage = useCallback(async (prompt: string) => {
    if (!chat) {
      setError("Chat session is not initialized.");
      return;
    }
    
    setError(null);
    setIsLoading(true);

    const userMessage: Message = { role: 'user', text: prompt };
    setMessages(prevMessages => [...prevMessages, userMessage]);

    // Add a placeholder for the model's response
    setMessages(prevMessages => [...prevMessages, { role: 'model', text: '' }]);

    try {
      const stream = await chat.sendMessageStream({ message: prompt });
      
      let fullResponse = '';
      for await (const chunk of stream) {
        const chunkText = chunk.text;
        fullResponse += chunkText;
        setMessages(prevMessages => {
          const newMessages = [...prevMessages];
          newMessages[newMessages.length - 1].text = fullResponse;
          return newMessages;
        });
      }
    } catch (e: any) {
      console.error(e);
      const errorMessage = e.message || "An unexpected error occurred.";
      setError(`Error: ${errorMessage}`);
      setMessages(prevMessages => {
          const newMessages = [...prevMessages];
          newMessages[newMessages.length - 1].text = `Üzgünüm, bir hata oluştu: ${errorMessage}`;
          return newMessages;
        });
    } finally {
      setIsLoading(false);
    }
  }, [chat]);

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans">
      <header className="flex items-center justify-center p-4 bg-gray-950/50 backdrop-blur-sm border-b border-gray-800 shadow-lg sticky top-0 z-10">
        <h1 className="text-2xl font-bold tracking-wider text-red-500">Td AI</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto">
        <ChatWindow messages={messages} isLoading={isLoading} />
         {error && (
            <div className="p-4 m-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-center">
              {error}
            </div>
          )}
      </main>
      
      <footer className="p-4 bg-black/80 backdrop-blur-sm sticky bottom-0">
        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </footer>
    </div>
  );
};

export default App;