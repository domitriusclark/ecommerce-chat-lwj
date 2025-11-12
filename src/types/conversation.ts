import type { UIProduct } from './product';

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  selfieImageId?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  products?: UIProduct[];
  generatedImageIds?: string[];
  timestamp: number;
}
