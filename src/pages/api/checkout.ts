import type { APIRoute } from "astro";

const SHOPIFY_STOREFRONT_ACCESS_TOKEN =
  import.meta.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const STOREFRONT_MCP_ENDPOINT = import.meta.env.STOREFRONT_MCP_ENDPOINT;
const SHOPIFY_API_VERSION = "2024-01";

const CART_CREATE_MUTATION = /* GraphQL */ `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CART_LINES_ADD_MUTATION = /* GraphQL */ `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        totalQuantity
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function deriveStorefrontApiUrl(): string | null {
  if (!STOREFRONT_MCP_ENDPOINT) return null;

  try {
    const endpointUrl = new URL(STOREFRONT_MCP_ENDPOINT);
    return `${endpointUrl.origin}/api/${SHOPIFY_API_VERSION}/graphql.json`;
  } catch (error) {
    console.error("Invalid STOREFRONT_MCP_ENDPOINT:", error);
    return null;
  }
}

async function callShopifyGraphQL<T>(query: string, variables: Record<string, any>) {
  const storefrontApiUrl = deriveStorefrontApiUrl();
  if (!storefrontApiUrl) {
    throw new Error("Unable to derive Shopify Storefront API URL");
  }

  const response = await fetch(storefrontApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_ACCESS_TOKEN || "",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Shopify Storefront API error (${response.status}): ${errorText.substring(0, 500)}`
    );
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(
      `Shopify GraphQL errors: ${JSON.stringify(json.errors)}`
    );
  }

  return json.data as T;
}

export const POST: APIRoute = async ({ request }) => {
  if (!SHOPIFY_STOREFRONT_ACCESS_TOKEN) {
    return new Response(
      JSON.stringify({
        error: "SHOPIFY_STOREFRONT_ACCESS_TOKEN is not configured",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { variantId, quantity = 1, cartId } = await request.json();

    if (!variantId) {
      return new Response(
        JSON.stringify({ error: "variantId is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const lines = [
      {
        quantity,
        merchandiseId: variantId,
      },
    ];

    if (cartId) {
      type CartLinesAddResponse = {
        cartLinesAdd: {
          cart: {
            id: string;
            checkoutUrl: string;
            totalQuantity: number;
          } | null;
          userErrors: Array<{ field?: string[]; message: string }>;
        };
      };

      const data = await callShopifyGraphQL<CartLinesAddResponse>(
        CART_LINES_ADD_MUTATION,
        { cartId, lines }
      );

      const result = data.cartLinesAdd;
      if (result.userErrors?.length) {
        throw new Error(result.userErrors.map((err) => err.message).join(", "));
      }

      if (!result.cart) {
        throw new Error("Cart could not be updated");
      }

      return new Response(
        JSON.stringify({
          cartId: result.cart.id,
          checkoutUrl: result.cart.checkoutUrl,
          totalQuantity: result.cart.totalQuantity,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } else {
      type CartCreateResponse = {
        cartCreate: {
          cart: {
            id: string;
            checkoutUrl: string;
            totalQuantity: number;
          } | null;
          userErrors: Array<{ field?: string[]; message: string }>;
        };
      };

      const data = await callShopifyGraphQL<CartCreateResponse>(
        CART_CREATE_MUTATION,
        { input: { lines } }
      );

      const result = data.cartCreate;
      if (result.userErrors?.length) {
        throw new Error(result.userErrors.map((err) => err.message).join(", "));
      }

      if (!result.cart) {
        throw new Error("Cart could not be created");
      }

      return new Response(
        JSON.stringify({
          cartId: result.cart.id,
          checkoutUrl: result.cart.checkoutUrl,
          totalQuantity: result.cart.totalQuantity,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({
        error: "Unable to process checkout request",
        detail: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
