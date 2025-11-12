import type { APIRoute } from "astro";
import { OpenRouter } from "@openrouter/sdk";
import {
  createConversation,
  generateConversationTitle,
  getConversation,
  getMessages,
  getSessionId,
  storeConversation,
  storeMessage,
} from "../../lib/blobStorage";
import type { StoredConversation } from "../../lib/blobStorage";
import type { UIProduct } from "../../types/product";
import { mapShopifyMCPToUIProduct } from "../../lib/productUtils";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

// Tool definitions for OpenRouter
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_shop_catalog",
      description:
        "Search the store's product catalog. Use natural language queries focused on product type, color, style, or other attributes.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Natural language search query (e.g., 'blue linen shirt', 'men's casual pants')",
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

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Execute MCP search_shop_catalog tool
async function executeSearchCatalog(
  query: string,
  first: number = 5,
  baseUrl: string
) {
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

export const POST: APIRoute = async (context) => {
  try {
    const { request, url } = context;
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

    const sessionId = getSessionId(context);
    const { message, newConversation, conversationId } = await request.json();

    // Handle new conversation request
    if (newConversation) {
      const conversation = await createConversation(sessionId);
      return new Response(JSON.stringify({ conversation }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let conversationRecord: StoredConversation | null = null;
    if (conversationId) {
      conversationRecord = await getConversation(sessionId, conversationId);
    }

    if (!conversationRecord) {
      conversationRecord = await createConversation(sessionId);
    }

    const resolvedConversationId = conversationRecord.id;

    // Get persisted history for this conversation
    const history = await getMessages(sessionId, resolvedConversationId);

    // Enhanced system prompt combining tool definitions and ecommerce context
    const enhancedSystemPrompt = `You are a helpful ecommerce shopping assistant. Help users find and shop for clothing, particularly shirts.

Available Tools:
- search_shop_catalog: Search the product catalog. Use focused, natural language queries like "blue linen shirt" or "women's oxford shirt white". Returns up to 5 products with title, price, image, and details.

IMPORTANT: When you use search_shop_catalog:
1. Use the tool with concise search terms to find relevant products
2. After the tool returns results, give a brief, friendly response acknowledging what you found
3. DO NOT list product names, prices, or details in your response - they will be displayed automatically in product cards below your message
4. Keep your response SHORT - just 1-2 sentences acknowledging the search
5. You can mention features like "try on any item with the virtual try-on feature" or "click to add to cart"

Example good responses after finding products:
- "I found some great flannels for you! Check them out below."
- "Here are some shirts that match what you're looking for."
- "Perfect! I found several options. You can virtually try on any of them!"

Example BAD responses (too detailed - don't do this):
- Listing product names, prices, or links
- Creating bullet point lists of products
- Using markdown to format product details

Key features available to users:
- Virtual try-on: Upload a photo and virtually try on any item
- Shopping cart: Add items and proceed to checkout
- Product search: Find specific styles, colors, or types

Be conversational, concise, and helpful!`;

    // Add system prompt if this is the first message
    const messages: ChatMessage[] = [];
    if (history.length === 0) {
      messages.push({ role: "system", content: enhancedSystemPrompt });
    }
    messages.push(
      ...history.map((historicalMessage) => ({
        role: historicalMessage.role,
        content: historicalMessage.content,
      })),
      { role: "user", content: message }
    );

    const userTimestamp = Date.now();
    await storeMessage(sessionId, {
      id: createMessageId(),
      conversationId: resolvedConversationId,
      role: "user",
      content: message,
      timestamp: userTimestamp,
    });

    conversationRecord.messageCount += 1;
    conversationRecord.updatedAt = userTimestamp;
    if (conversationRecord.messageCount === 1) {
      conversationRecord.title = generateConversationTitle(message);
    }
    await storeConversation(sessionId, conversationRecord);

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
        let storedProducts: UIProduct[] | undefined = undefined;
        let productPayloadForClient: any[] = [];

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
                    function: {
                      name: toolCall.function?.name || "",
                      arguments: "",
                    },
                  };
                }
                if (toolCall.function?.arguments) {
                  toolCalls[index].function.arguments +=
                    toolCall.function.arguments;
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
              {
                role: "assistant" as const,
                content: assistantMessage,
                tool_calls: toolCalls,
              },
            ];

            // Execute tool calls and collect product data
            for (const toolCall of toolCalls) {
              if (toolCall.function.name === "search_shop_catalog") {
                console.log(
                  "Executing search_shop_catalog with args:",
                  toolCall.function.arguments
                );
                const args = JSON.parse(toolCall.function.arguments);
                const toolResult = await executeSearchCatalog(
                  args.query,
                  args.first || 5,
                  baseUrl
                );
                console.log(
                  "Tool result:",
                  JSON.stringify(toolResult).substring(0, 200)
                );

                // Extract product data from MCP response
                try {
                  if (toolResult.content && toolResult.content[0]?.text) {
                    const parsedContent = JSON.parse(toolResult.content[0].text);
                    if (parsedContent.products && Array.isArray(parsedContent.products)) {
                      productPayloadForClient = parsedContent.products;
                      storedProducts = parsedContent.products.map((product: any) =>
                        mapShopifyMCPToUIProduct(product)
                      );
                      console.log(`Extracted ${productPayloadForClient.length} products from Shopify MCP`);
                    }
                  }
                } catch (e) {
                  console.error("Failed to extract products from MCP response:", e);
                }

                newHistory.push({
                  role: "assistant" as const,
                  content: JSON.stringify(toolResult),
                  tool_call_id: toolCall.id,
                  name: "search_shop_catalog",
                });
              }
            }

            // Stream product data marker before AI response (even if empty array)
            const productMarker = `[SHOPIFY_PRODUCTS]${JSON.stringify(
              productPayloadForClient
            )}[/SHOPIFY_PRODUCTS]\n`;
            controller.enqueue(new TextEncoder().encode(productMarker));
            console.log(
              "Streamed product data marker with",
              productPayloadForClient.length,
              "products"
            );

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
            const assistantTimestamp = Date.now();
            await storeMessage(sessionId, {
              id: createMessageId(),
              conversationId: resolvedConversationId,
              role: "assistant",
              content: finalMessage,
              products: storedProducts,
              timestamp: assistantTimestamp,
            });

            conversationRecord.messageCount += 1;
            conversationRecord.updatedAt = assistantTimestamp;
            await storeConversation(sessionId, conversationRecord);
          } else {
            // No tool calls, just save the message
            const assistantTimestamp = Date.now();
            await storeMessage(sessionId, {
              id: createMessageId(),
              conversationId: resolvedConversationId,
              role: "assistant",
              content: assistantMessage,
              timestamp: assistantTimestamp,
            });

            conversationRecord.messageCount += 1;
            conversationRecord.updatedAt = assistantTimestamp;
            await storeConversation(sessionId, conversationRecord);
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
        ...STREAM_HEADERS,
        "X-Conversation-Id": resolvedConversationId,
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
