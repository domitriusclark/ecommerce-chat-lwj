import { getStore } from '@netlify/blobs';
import type { APIContext } from 'astro';

// Store names
export const STORES = {
  UPLOADED_IMAGES: 'uploaded-images',
  GENERATED_IMAGES: 'generated-images',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
} as const;

// Session management
export const SESSION_COOKIE_NAME = 'ecommerce_chat_session';
export const SESSION_ID_LENGTH = 32;

type StoreConnectionOptions = {
  siteID: string;
  token: string;
  apiURL?: string;
};

const mergedEnv = import.meta.env as Record<string, string | undefined>;

const manualStoreOptions: StoreConnectionOptions | null = (() => {
  const siteID = mergedEnv.NETLIFY_BLOBS_SITE_ID;
  const token = mergedEnv.NETLIFY_BLOBS_TOKEN;
  const apiURL = mergedEnv.NETLIFY_BLOBS_API_URL;

  if (siteID && token) {
    return {
      siteID,
      token,
      ...(apiURL ? { apiURL } : {}),
    };
  }

  return null;
})();

function getConfiguredStore(storeName: string) {
  if (manualStoreOptions) {
    return getStore({
      name: storeName,
      ...manualStoreOptions,
    });
  }

  return getStore(storeName);
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < SESSION_ID_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get or create session ID from cookies
 */
export function getSessionId(context: APIContext): string {
  const existingSession = context.cookies.get(SESSION_COOKIE_NAME);

  if (existingSession?.value) {
    return existingSession.value;
  }

  const newSessionId = generateSessionId();
  context.cookies.set(SESSION_COOKIE_NAME, newSessionId, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return newSessionId;
}

// Type definitions
export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  selfieImageId?: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  products?: any[];
  generatedImageIds?: string[];
  timestamp: number;
}

export interface ImageMetadata {
  id: string;
  type: 'uploaded' | 'generated';
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  conversationId?: string;
  productId?: string;
}

// Image expiration: 24 hours
const IMAGE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Store an uploaded image
 */
export async function storeUploadedImage(
  sessionId: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<string> {
  const store = getConfiguredStore(STORES.UPLOADED_IMAGES);
  const imageId = `${Date.now()}-${generateSessionId().substring(0, 8)}`;
  const key = `${sessionId}/${imageId}`;

  const metadata: ImageMetadata = {
    id: imageId,
    type: 'uploaded',
    sessionId,
    createdAt: Date.now(),
    expiresAt: Date.now() + IMAGE_EXPIRATION_MS,
  };

  await store.set(key, imageBuffer, {
    metadata: {
      contentType,
      ...metadata,
    },
  });

  return imageId;
}

/**
 * Store a generated image
 */
export async function storeGeneratedImage(
  sessionId: string,
  imageBuffer: Buffer,
  contentType: string,
  conversationId?: string,
  productId?: string
): Promise<string> {
  const store = getConfiguredStore(STORES.GENERATED_IMAGES);
  const imageId = `${Date.now()}-${generateSessionId().substring(0, 8)}`;
  const key = `${sessionId}/${imageId}`;

  const metadata: ImageMetadata = {
    id: imageId,
    type: 'generated',
    sessionId,
    createdAt: Date.now(),
    expiresAt: Date.now() + IMAGE_EXPIRATION_MS,
    conversationId,
    productId,
  };

  await store.set(key, imageBuffer, {
    metadata: {
      contentType,
      ...metadata,
    },
  });

  return imageId;
}

/**
 * Retrieve an image
 */
export async function getImage(
  sessionId: string,
  imageId: string,
  storeName: typeof STORES.UPLOADED_IMAGES | typeof STORES.GENERATED_IMAGES
): Promise<{ data: Blob | null; metadata: any }> {
  const store = getConfiguredStore(storeName);
  const key = `${sessionId}/${imageId}`;

  const { blob, metadata } = await store.getWithMetadata(key, {
    type: 'blob',
  });

  // Check if expired
  if (metadata?.expiresAt && Date.now() > metadata.expiresAt) {
    // Delete expired image
    await store.delete(key);
    return { data: null, metadata: null };
  }

  return { data: blob, metadata };
}

/**
 * Delete an image
 */
export async function deleteImage(
  sessionId: string,
  imageId: string,
  storeName: typeof STORES.UPLOADED_IMAGES | typeof STORES.GENERATED_IMAGES
): Promise<void> {
  const store = getConfiguredStore(storeName);
  const key = `${sessionId}/${imageId}`;
  await store.delete(key);
}

/**
 * Store a conversation
 */
export async function storeConversation(
  sessionId: string,
  conversation: StoredConversation
): Promise<void> {
  const store = getConfiguredStore(STORES.CONVERSATIONS);
  const key = `${sessionId}/${conversation.id}`;
  await store.setJSON(key, conversation);
}

/**
 * Create and persist a new conversation
 */
export async function createConversation(
  sessionId: string,
  title?: string,
  selfieImageId?: string
): Promise<StoredConversation> {
  const now = Date.now();
  const conversation: StoredConversation = {
    id: `${now}-${generateSessionId().substring(0, 8)}`,
    title: title?.trim() || 'New conversation',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    selfieImageId,
  };

  await storeConversation(sessionId, conversation);
  return conversation;
}

/**
 * Get a conversation
 */
export async function getConversation(
  sessionId: string,
  conversationId: string
): Promise<StoredConversation | null> {
  const store = getConfiguredStore(STORES.CONVERSATIONS);
  const key = `${sessionId}/${conversationId}`;
  return await store.get(key, { type: 'json' });
}

/**
 * List all conversations for a session
 */
export async function listConversations(
  sessionId: string
): Promise<StoredConversation[]> {
  const store = getConfiguredStore(STORES.CONVERSATIONS);
  const prefix = `${sessionId}/`;

  const conversations: StoredConversation[] = [];
  const { blobs } = await store.list({ prefix });

  for (const blob of blobs) {
    const conversation = await store.get(blob.key, { type: 'json' });
    if (conversation) {
      conversations.push(conversation);
    }
  }

  // Sort by updatedAt descending
  return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  sessionId: string,
  conversationId: string
): Promise<void> {
  const conversationStore = getConfiguredStore(STORES.CONVERSATIONS);
  const messageStore = getConfiguredStore(STORES.MESSAGES);

  // Delete conversation
  await conversationStore.delete(`${sessionId}/${conversationId}`);

  // Delete all messages
  const messagePrefix = `${sessionId}/${conversationId}/`;
  const { blobs } = await messageStore.list({ prefix: messagePrefix });

  for (const blob of blobs) {
    await messageStore.delete(blob.key);
  }
}

/**
 * Store a message
 */
export async function storeMessage(
  sessionId: string,
  message: StoredMessage
): Promise<void> {
  const store = getConfiguredStore(STORES.MESSAGES);
  const key = `${sessionId}/${message.conversationId}/${message.id}`;
  await store.setJSON(key, message);
}

/**
 * Get all messages for a conversation
 */
export async function getMessages(
  sessionId: string,
  conversationId: string
): Promise<StoredMessage[]> {
  const store = getConfiguredStore(STORES.MESSAGES);
  const prefix = `${sessionId}/${conversationId}/`;

  const messages: StoredMessage[] = [];
  const { blobs } = await store.list({ prefix });

  for (const blob of blobs) {
    const message = await store.get(blob.key, { type: 'json' });
    if (message) {
      messages.push(message);
    }
  }

  // Sort by timestamp ascending
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Delete a message
 */
export async function deleteMessage(
  sessionId: string,
  conversationId: string,
  messageId: string
): Promise<void> {
  const store = getConfiguredStore(STORES.MESSAGES);
  const key = `${sessionId}/${conversationId}/${messageId}`;
  await store.delete(key);
}

/**
 * Update existing conversation metadata
 */
export async function updateConversation(
  sessionId: string,
  conversationId: string,
  updates: Partial<Pick<StoredConversation, 'title' | 'updatedAt' | 'messageCount' | 'selfieImageId'>>
): Promise<StoredConversation | null> {
  const existing = await getConversation(sessionId, conversationId);
  if (!existing) {
    return null;
  }

  const nextConversation: StoredConversation = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    messageCount: updates.messageCount ?? existing.messageCount,
  };

  if (!nextConversation.title) {
    nextConversation.title = 'New conversation';
  }

  await storeConversation(sessionId, nextConversation);
  return nextConversation;
}

/**
 * Generate conversation title from first message
 */
export function generateConversationTitle(firstMessage: string): string {
  const maxLength = 50;
  const cleaned = firstMessage.trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.substring(0, maxLength - 3) + '...';
}
