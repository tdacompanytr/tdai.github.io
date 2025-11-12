
export interface FileData {
  base64: string;
  mimeType: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  file?: FileData;
}
