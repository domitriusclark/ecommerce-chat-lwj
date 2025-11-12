import type { APIRoute } from "astro";
import { OpenRouter } from "@openrouter/sdk";

const CHAT_HISTORY_KEY = "current-chat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// In-memory storage for chat history (replace with database in production)
const chatHistory = new Map<string, ChatMessage[]>();

export const POST: APIRoute = async ({ request }) => {
  try {
    // Initialize OpenRouter client with API key from environment
    const apiKey = import.meta.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = new OpenRouter({
      apiKey: apiKey,
    });

    const { message, newConversation } = await request.json();

    // Handle new conversation request
    if (newConversation) {
      chatHistory.set(CHAT_HISTORY_KEY, []);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get history and update with user message
    const history = chatHistory.get(CHAT_HISTORY_KEY) || [];
    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: message },
    ];

    // Stream the AI response via OpenRouter SDK
    const stream = await client.chat.send({
      model: "openai/gpt-3.5-turbo",
      messages: updatedHistory,
      stream: true,
    });

    // Create a readable stream for the response
    const responseStream = new ReadableStream({
      async start(controller) {
        let assistantMessage = "";

        try {
          for await (const chunk of stream) {
            const text = chunk.choices?.[0]?.delta?.content || "";
            if (text) {
              assistantMessage += text;
              controller.enqueue(new TextEncoder().encode(text));
            }
          }

          // Save the complete conversation history
          chatHistory.set(CHAT_HISTORY_KEY, [
            ...updatedHistory,
            { role: "assistant", content: assistantMessage },
          ]);

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
