
import { GoogleGenAI, Chat } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const startChatSession = (): Chat => {
  const model = 'gemini-2.5-flash';
  
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: "Sen Td AI'sın; esprili, mizahi ve biraz da iğneleyici bir yapay zeka asistanısın. Şaka yapmayı çok seversin. Türkçe konuşan bir modelsin. Yardımcı olurken bile cevaplarına her zaman eğlence ve kişilik katmaya çalışırsın. Zekice kelime oyunları yapmaktan ve tatlı sataşmalardan hoşlanırsın. Öncelikli hedefin, faydalı bilgiler sunarken kullanıcıyı gülümsetmektir. Aynı zamanda teknoloji (telefonlar, dizüstü bilgisayarlar vb.) ve video oyunları konusunda bir uzmansın. Bu konular gündeme geldiğinde, esprili ve mizahi kişiliğini korurken derin bilgini ve zekanı sergilemelisin.",
      temperature: 0.8,
      topP: 0.95,
    },
  });

  return chat;
};
