import type { APIRoute } from 'astro';
import {
  createConversation,
  getSessionId,
  listConversations,
} from '../../../lib/blobStorage';

const jsonHeaders = { 'Content-Type': 'application/json' };

export const GET: APIRoute = async (context) => {
  try {
    const sessionId = getSessionId(context);
    const conversations = await listConversations(sessionId);
    return new Response(JSON.stringify({ conversations }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error: any) {
    console.error('Failed to list conversations:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list conversations' }),
      { status: 500, headers: jsonHeaders }
    );
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const sessionId = getSessionId(context);
    const body = (await context.request.json().catch(() => ({}))) as {
      title?: string;
      selfieImageId?: string;
    };

    const conversation = await createConversation(
      sessionId,
      body?.title,
      body?.selfieImageId
    );

    return new Response(JSON.stringify({ conversation }), {
      status: 201,
      headers: jsonHeaders,
    });
  } catch (error: any) {
    console.error('Failed to create conversation:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create conversation' }),
      { status: 500, headers: jsonHeaders }
    );
  }
};
