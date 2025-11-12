/**
 * Shopify Storefront API Client
 * Handles checkout creation and cart management
 */

const SHOPIFY_STORE_DOMAIN = import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN || 'your-store.myshopify.com';
const STOREFRONT_API_TOKEN = import.meta.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN;
const STOREFRONT_API_VERSION = '2024-01';

interface LineItem {
  variantId: string;
  quantity: number;
}

interface CheckoutCreateResponse {
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
}

/**
 * Creates a Shopify checkout session with the provided line items
 */
export async function createCheckout(lineItems: LineItem[]): Promise<{ webUrl: string; checkoutId: string }> {
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
      lineItems: lineItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    },
  };

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
    throw new Error(`Shopify API error: ${response.statusText}`);
  }

  const data: { data: CheckoutCreateResponse } = await response.json();

  if (data.data.checkoutCreate.checkoutUserErrors.length > 0) {
    const errors = data.data.checkoutCreate.checkoutUserErrors
      .map(err => err.message)
      .join(', ');
    throw new Error(`Checkout errors: ${errors}`);
  }

  return {
    webUrl: data.data.checkoutCreate.checkout.webUrl,
    checkoutId: data.data.checkoutCreate.checkout.id,
  };
}

