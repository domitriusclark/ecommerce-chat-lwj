import type { APIRoute } from 'astro';
import {
  getConversation,
  getMessages,
  getSessionId,
  updateConversation,
} from '../../../lib/blobStorage';

const jsonHeaders = { 'Content-Type': 'application/json' };

export const GET: APIRoute = async (context) => {
  try {
    const { conversationId } = context.params;
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'Conversation ID is required' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const sessionId = getSessionId(context);
    const conversation = await getConversation(sessionId, conversationId);

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    const messages = await getMessages(sessionId, conversationId);

    return new Response(
      JSON.stringify({ conversation, messages }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error: any) {
    console.error('Failed to fetch conversation', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch conversation' }),
      { status: 500, headers: jsonHeaders }
    );
  }
};

export const PATCH: APIRoute = async (context) => {
  try {
    const { conversationId } = context.params;
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'Conversation ID is required' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const sessionId = getSessionId(context);
    const payload = (await context.request.json().catch(() => ({}))) as {
      title?: string;
      selfieImageId?: string | null;
    };

    const updates: Record<string, any> = {};

    if (typeof payload.title === 'string') {
      updates.title = payload.title.trim() || 'New conversation';
    }

    if (payload.selfieImageId !== undefined) {
      updates.selfieImageId = payload.selfieImageId || undefined;
    }

    updates.updatedAt = Date.now();

    const updatedConversation = await updateConversation(
      sessionId,
      conversationId,
      updates
    );

    if (!updatedConversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({ conversation: updatedConversation }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error: any) {
    console.error('Failed to update conversation', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update conversation' }),
      { status: 500, headers: jsonHeaders }
    );
  }
};
