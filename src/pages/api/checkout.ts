import type { APIRoute } from 'astro';

const SHOPIFY_STORE_DOMAIN = import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN || 'your-store.myshopify.com';
const STOREFRONT_API_TOKEN = import.meta.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN;
const STOREFRONT_API_VERSION = '2024-01';

interface LineItem {
  variantId: string;
  quantity: number;
}

interface CheckoutCreateResponse {
  data: {
    checkoutCreate: {
      checkout: {
        id: string;
        webUrl: string;
      };
      checkoutUserErrors: Array<{
        message: string;
        field: string[];
      }>;
    };
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { lineItems } = await request.json();

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid line items' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate environment variables
    if (!STOREFRONT_API_TOKEN) {
      console.error('SHOPIFY_STOREFRONT_API_ACCESS_TOKEN is not set');
      return new Response(
        JSON.stringify({ error: 'Shopify API token not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create checkout mutation
    const mutation = `
      mutation checkoutCreate($input: CheckoutCreateInput!) {
        checkoutCreate(input: $input) {
          checkout {
            id
            webUrl
          }
          checkoutUserErrors {
            message
            field
          }
        }
      }
    `;

    const variables = {
      input: {
        lineItems: lineItems.map((item: LineItem) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      },
    };

    // Call Shopify Storefront API
    const response = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/api/${STOREFRONT_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_API_TOKEN,
        },
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create checkout',
          details: errorText 
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data: CheckoutCreateResponse = await response.json();

    // Check for user errors
    if (data.data.checkoutCreate.checkoutUserErrors.length > 0) {
      const errors = data.data.checkoutCreate.checkoutUserErrors
        .map(err => err.message)
        .join(', ');
      console.error('Checkout creation errors:', errors);
      return new Response(
        JSON.stringify({ error: errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return checkout URL
    return new Response(
      JSON.stringify({
        checkoutUrl: data.data.checkoutCreate.checkout.webUrl,
        checkoutId: data.data.checkoutCreate.checkout.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

