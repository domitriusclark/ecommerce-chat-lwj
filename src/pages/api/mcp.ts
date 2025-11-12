import type { APIRoute } from "astro";

const STOREFRONT_MCP_ENDPOINT = import.meta.env.STOREFRONT_MCP_ENDPOINT;
const SHOPIFY_STOREFRONT_PASSWORD = import.meta.env.SHOPIFY_STOREFRONT_PASSWORD;

// Cache for the storefront access token
let storefrontAccessToken: string | null = null;

/**
 * Authenticate with Shopify's storefront password protection
 * Returns the access token cookie value
 */
async function authenticateStorefront(): Promise<string | null> {
  if (!SHOPIFY_STOREFRONT_PASSWORD || !STOREFRONT_MCP_ENDPOINT) {
    return null;
  }

  // Extract store domain from MCP endpoint
  const storeDomain = STOREFRONT_MCP_ENDPOINT.replace("/api/mcp", "");

  try {
    console.log("Attempting authentication to:", `${storeDomain}/password`);

    const response = await fetch(`${storeDomain}/password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `form_type=storefront_password&utf8=✓&password=${encodeURIComponent(SHOPIFY_STOREFRONT_PASSWORD)}`,
      redirect: "manual", // Don't follow redirects
    });

    console.log("Auth response status:", response.status);
    console.log("Auth response headers:", Object.fromEntries(response.headers.entries()));

    // For successful authentication, Shopify returns 302 with cookies
    if (response.status === 302) {
      const setCookie = response.headers.get("set-cookie");
      console.log("Set-Cookie header:", setCookie);

      if (setCookie) {
        // Try to extract _shopify_essential cookie (this is what auth returns)
        const essentialMatch = setCookie.match(/_shopify_essential=([^;]+)/);
        if (essentialMatch) {
          console.log("Successfully extracted _shopify_essential token");
          return `_shopify_essential=${essentialMatch[1]}`;
        }

        // Also try storefront_digest as fallback
        const digestMatch = setCookie.match(/storefront_digest=([^;]+)/);
        if (digestMatch) {
          console.log("Successfully extracted storefront_digest token");
          return digestMatch[1];
        }
      }
    }

    console.error("Failed to extract storefront access token from authentication response");
    console.error("Response status:", response.status);
    const bodyText = await response.text();
    console.error("Response body (first 200 chars):", bodyText.substring(0, 200));
    return null;
  } catch (error) {
    console.error("Error authenticating with storefront:", error);
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Validate environment configuration
    if (!STOREFRONT_MCP_ENDPOINT) {
      console.error("STOREFRONT_MCP_ENDPOINT is not set");
      return new Response(
        JSON.stringify({ error: "MCP endpoint not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { tool, args } = await request.json();

    if (!tool) {
      return new Response(JSON.stringify({ error: "Missing tool parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Authenticate if password is configured and we don't have a cached token
    if (SHOPIFY_STOREFRONT_PASSWORD && !storefrontAccessToken) {
      console.log("Authenticating with storefront password...");
      storefrontAccessToken = await authenticateStorefront();
      if (!storefrontAccessToken) {
        return new Response(
          JSON.stringify({
            error: "Authentication failed",
            detail: "Could not authenticate with storefront password. Please check SHOPIFY_STOREFRONT_PASSWORD.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      console.log("Successfully authenticated with storefront");
    }

    // Call the Shopify Storefront MCP server using JSON-RPC 2.0 format
    console.log(`Calling MCP tool: ${tool} at ${STOREFRONT_MCP_ENDPOINT}`);

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    // Add authentication cookie if available
    if (storefrontAccessToken) {
      headers["cookie"] = storefrontAccessToken;
    }

    const res = await fetch(STOREFRONT_MCP_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: {
          name: tool,
          arguments: args ?? {},
        },
      }),
    });

    // Check for redirect (password protection or expired token)
    if (res.status === 302 || res.status === 301) {
      const location = res.headers.get("location");
      if (location?.includes("/password")) {
        // Token expired or invalid, try to re-authenticate once
        if (SHOPIFY_STOREFRONT_PASSWORD && storefrontAccessToken) {
          console.log("Token expired, re-authenticating...");
          storefrontAccessToken = null;
          storefrontAccessToken = await authenticateStorefront();

          if (storefrontAccessToken) {
            // Retry the request with new token
            const retryHeaders: Record<string, string> = {
              "content-type": "application/json",
              cookie: storefrontAccessToken,
            };

            const retryRes = await fetch(STOREFRONT_MCP_ENDPOINT, {
              method: "POST",
              headers: retryHeaders,
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                id: Date.now(),
                params: {
                  name: tool,
                  arguments: args ?? {},
                },
              }),
            });

            // Continue with the retry response
            if (retryRes.ok) {
              const retryText = await retryRes.text();
              const retryJson = JSON.parse(retryText);
              return new Response(JSON.stringify(retryJson.result || retryJson), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
          }
        }

        return new Response(
          JSON.stringify({
            error: "Store is password-protected",
            detail: SHOPIFY_STOREFRONT_PASSWORD
              ? "Authentication failed. Please check SHOPIFY_STOREFRONT_PASSWORD in your .env file."
              : "The Shopify store has password protection enabled. Please add SHOPIFY_STOREFRONT_PASSWORD to your .env file.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`MCP error ${res.status}:`, text);
      return new Response(
        JSON.stringify({
          error: `MCP error ${res.status}`,
          detail: text,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse JSON-RPC 2.0 response
    const responseText = await res.text();
    console.log("MCP Response status:", res.status);
    console.log("MCP Response headers:", Object.fromEntries(res.headers.entries()));
    console.log("MCP Response body (first 500 chars):", responseText.substring(0, 500));

    let jsonRpcResponse;
    try {
      jsonRpcResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse MCP response as JSON:", parseError);
      return new Response(
        JSON.stringify({
          error: "Invalid JSON response from MCP server",
          detail: `Response was: ${responseText.substring(0, 200)}`,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check for JSON-RPC error
    if (jsonRpcResponse.error) {
      console.error("MCP JSON-RPC error:", jsonRpcResponse.error);
      return new Response(
        JSON.stringify({
          error: "MCP tool error",
          detail: jsonRpcResponse.error.message || JSON.stringify(jsonRpcResponse.error),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return the result from the JSON-RPC response
    return new Response(JSON.stringify(jsonRpcResponse.result || jsonRpcResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Proxy error:", e);
    return new Response(
      JSON.stringify({ error: "Proxy error", detail: e?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
