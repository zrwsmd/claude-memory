export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; [key: string]: any }>;
  timestamp?: number;
}

export interface ClaudeConversation {
  id: string;
  projectPath: string;
  projectName: string;
  messages: ClaudeMessage[];
  firstMessage: string;
  lastTimestamp: number;
  messageCount: number;
  filePath: string;
  searchSnippet?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  claudePath: string;
}
