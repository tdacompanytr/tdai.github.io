
export interface FileData {
  base64: string;
  mimeType: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  file?: FileData;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

export interface UserProfile {
  name: string;
  avatar: string | null; // base64 string
}
