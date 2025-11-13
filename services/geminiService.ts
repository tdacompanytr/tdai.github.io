
import { GoogleGenAI, Chat, HarmCategory, HarmBlockThreshold, Content, Part } from "@google/genai";
import type { Message } from '../types';

const getAiInstance = (): GoogleGenAI => {
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    // Throw a specific error that can be caught by the UI
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

// Configuration for safety settings to block harmful content
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];


export const startChatSession = (systemInstruction: string): Chat => {
  const ai = getAiInstance();
  const model = 'gemini-2.5-flash';
  
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction,
      temperature: 0.8,
      topP: 0.95,
      safetySettings,
    },
  });

  return chat;
};

export const resumeChatSession = (systemInstruction: string, history: Message[]): Chat => {
  const ai = getAiInstance();
  const model = 'gemini-2.5-flash';

  // Convert app's message format to Gemini's history format
  const geminiHistory: Content[] = history.map(msg => {
    const parts: Part[] = [];
    if (msg.text) {
      parts.push({ text: msg.text });
    }
    if (msg.file) {
      parts.push({
        inlineData: {
          mimeType: msg.file.mimeType,
          data: msg.file.base64,
        },
      });
    }
    return {
      role: msg.role,
      parts: parts,
    };
  }).filter(content => content.parts.length > 0);


  const chat = ai.chats.create({
    model,
    history: geminiHistory,
    config: {
      systemInstruction,
      temperature: 0.8,
      topP: 0.95,
      safetySettings,
    },
  });

  return chat;
};
