import type { APIRoute } from "astro";
import { OpenRouter } from "@openrouter/sdk";

const CHAT_HISTORY_KEY = "current-chat";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

// System prompt with tool definitions
const SYSTEM_PROMPT = `You are a helpful shopping assistant for an online clothing store.

Available Tools:
- search_shop_catalog: Search the product catalog. Use focused, natural language queries like "blue linen shirt" or "women's oxford shirt white". Returns up to 5 products with title, price, image, and details.

When users ask about products:
1. Use search_shop_catalog with concise search terms
2. Present results clearly with product names and prices
3. Be helpful and conversational

Keep responses concise and friendly.`;

// Tool definitions for OpenRouter
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_shop_catalog",
      description: "Search the store's product catalog. Use natural language queries focused on product type, color, style, or other attributes.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language search query (e.g., 'blue linen shirt', 'men's casual pants')",
          },
          first: {
            type: "number",
            description: "Number of results to return (default: 5, max: 10)",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
  },
];

// In-memory storage for chat history (replace with database in production)
const chatHistory = new Map<string, ChatMessage[]>();

// Execute MCP search_shop_catalog tool
async function executeSearchCatalog(query: string, first: number = 5, baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "search_shop_catalog",
        args: {
          query,
          context: `User is searching for: ${query}`,
          first,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to search catalog" };
    }

    return await response.json();
  } catch (error: any) {
    return { error: error.message || "Failed to search catalog" };
  }
}

export const POST: APIRoute = async ({ request, url }) => {
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

    // Get base URL from request
    const baseUrl = `${url.protocol}//${url.host}`;

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

    // Add system prompt if this is the first message
    const messages: ChatMessage[] = [];
    if (history.length === 0) {
      messages.push({ role: "system", content: SYSTEM_PROMPT });
    }
    messages.push(...history, { role: "user", content: message });

    // Call OpenRouter with tool support
    const stream = await client.chat.send({
      model: "openai/gpt-4o-mini", // Use gpt-4o-mini for better tool calling
      messages: messages,
      tools: TOOLS,
      stream: true,
    });

    // Create a readable stream for the response
    const responseStream = new ReadableStream({
      async start(controller) {
        let assistantMessage = "";
        let toolCalls: any[] = [];

        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta;

            // Handle text content
            const text = delta?.content || "";
            if (text) {
              assistantMessage += text;
              controller.enqueue(new TextEncoder().encode(text));
            }

            // Handle tool calls
            if (delta?.toolCalls) {
              for (const toolCall of delta.toolCalls) {
                const index = toolCall.index;
                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: toolCall.id,
                    type: "function",
                    function: { name: toolCall.function?.name || "", arguments: "" }
                  };
                }
                if (toolCall.function?.arguments) {
                  toolCalls[index].function.arguments += toolCall.function.arguments;
                }
              }
            }
          }

          // If there are tool calls, execute them
          if (toolCalls.length > 0) {
            console.log("Tool calls detected:", toolCalls.length);
            console.log("Tool calls:", JSON.stringify(toolCalls));
            const newHistory = [
              ...messages,
              { role: "assistant" as const, content: assistantMessage, tool_calls: toolCalls }
            ];

            // Execute tool calls
            for (const toolCall of toolCalls) {
              if (toolCall.function.name === "search_shop_catalog") {
                console.log("Executing search_shop_catalog with args:", toolCall.function.arguments);
                const args = JSON.parse(toolCall.function.arguments);
                const toolResult = await executeSearchCatalog(args.query, args.first || 5, baseUrl);
                console.log("Tool result:", JSON.stringify(toolResult).substring(0, 200));

                newHistory.push({
                  role: "assistant" as const,
                  content: JSON.stringify(toolResult),
                  tool_call_id: toolCall.id,
                  name: "search_shop_catalog"
                });
              }
            }

            // Get final response from AI with tool results
            const finalStream = await client.chat.send({
              model: "openai/gpt-4o-mini",
              messages: newHistory,
              stream: true,
            });

            let finalMessage = "";
            for await (const chunk of finalStream) {
              const text = chunk.choices?.[0]?.delta?.content || "";
              if (text) {
                finalMessage += text;
                controller.enqueue(new TextEncoder().encode(text));
              }
            }

            // Save with tool interaction
            chatHistory.set(CHAT_HISTORY_KEY, [
              ...history,
              { role: "user", content: message },
              { role: "assistant", content: finalMessage }
            ]);
          } else {
            // No tool calls, just save the message
            chatHistory.set(CHAT_HISTORY_KEY, [
              ...history,
              { role: "user", content: message },
              { role: "assistant", content: assistantMessage },
            ]);
          }

          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
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
