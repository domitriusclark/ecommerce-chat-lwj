/**
 * MCP Client Helper
 * Provides typed interface for calling Shopify Storefront MCP tools
 */

export interface MCPError {
  error: string;
  detail?: string;
}

export interface MCPResponse<T = any> {
  content?: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
  data?: T;
  [key: string]: any;
}

/**
 * Call an MCP tool via the proxy endpoint
 * @param tool - The name of the MCP tool to call
 * @param args - Optional arguments for the tool
 * @returns The MCP response data
 * @throws Error if the request fails
 */
export async function callMCP<T = any>(
  tool: string,
  args?: Record<string, any>
): Promise<MCPResponse<T>> {
  const res = await fetch("/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool, args }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorDetail: MCPError;
    try {
      errorDetail = JSON.parse(errorText);
    } catch {
      errorDetail = { error: errorText };
    }
    throw new Error(
      `MCP call failed: ${errorDetail.error}${errorDetail.detail ? ` - ${errorDetail.detail}` : ""}`
    );
  }

  return res.json();
}

/**
 * Search the shop catalog
 * @param query - Natural language search query
 * @param context - Conversational context to help understand user intent
 * @param first - Number of results to return (default: 5)
 */
export async function searchShopCatalog(
  query: string,
  context: string = "User is browsing the store catalog",
  first: number = 5
) {
  return callMCP("search_shop_catalog", { query, context, first });
}

/**
 * Search shop policies and FAQs
 * @param query - The policy question
 */
export async function searchShopPolicies(query: string) {
  return callMCP("search_shop_policies_and_faqs", { query });
}

/**
 * Get the current cart
 */
export async function getCart() {
  return callMCP("get_cart");
}

/**
 * Update the cart with items
 * @param items - Array of cart line items
 */
export async function updateCart(items: Array<{ variantId: string; quantity: number }>) {
  return callMCP("update_cart", { lines: items });
}
