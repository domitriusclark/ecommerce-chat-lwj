# Product Data Flow - Detailed Breakdown

## Overview

This document details how product data flows through the application, from mock data to display in the UI, including the critical rendering pipeline.

## Data Structure

### Source: Mock Products

**Location**: `src/lib/productUtils.ts` (embedded as constant)

**Structure**: Shopify-compatible format with 8 shirt products

```typescript
const MOCK_PRODUCTS: ShopifyProduct[] = [
  {
    id: "gid://shopify/Product/1",
    title: "Classic White Oxford Shirt",
    description: "A timeless white oxford shirt...",
    images: [{ src: "https://...", alt: "..." }],
    variants: [
      { id: "...", title: "Small", price: "49.99", availableForSale: true },
      // ... more variants
    ],
    availableForSale: true,
    metafields: {
      custom: {
        overlay_asset_shirt: "https://..." // Used for try-on
      }
    }
  },
  // ... 7 more products
]
```

### Transformation: ShopifyProduct → UIProduct

**Function**: `mapToUIProduct()` in `src/lib/productUtils.ts`

**Purpose**: Normalizes Shopify data structure into a simplified UI-friendly format

**Transformations**:
- Extracts first image from `images` array → `imageUrl`
- Extracts first variant for default price → `price`
- Parses price string to number
- Generates `handle` and `url` from title
- Extracts `overlay_asset_shirt` metafield → `overlayAssetUrl`

```typescript
export function mapToUIProduct(product: ShopifyProduct): UIProduct {
  const firstVariant = product.variants?.[0];
  const firstImage = product.images?.[0];

  return {
    id: product.id,
    title: product.title,
    description: product.description,
    imageUrl: firstImage?.src,
    price: firstVariant ? {
      amount: parseFloat(firstVariant.price),
      currencyCode: 'USD',
    } : undefined,
    variants: product.variants,
    overlayAssetUrl: product.metafields?.custom?.overlay_asset_shirt,
    handle: product.title.toLowerCase().replace(/\s+/g, '-'),
    url: `/products/${product.title.toLowerCase().replace(/\s+/g, '-')}`,
  };
}
```

## Product Search Flow

### Step 1: User Query

User types a message in the chat, e.g., "show me shirts"

### Step 2: Keyword Detection

**Location**: `Chat.tsx` - `detectProductQuery()` function

**Triggers**: Array of keywords
```typescript
const productKeywords = [
  "shirt", "shirts", "clothing", "wear",
  "buy", "shop", "show", "find"
];
```

**Logic**:
```typescript
function detectProductQuery(text: string): UIProduct[] | null {
  const lowerText = text.toLowerCase();
  const hasProductKeyword = productKeywords.some(keyword => 
    lowerText.includes(keyword)
  );
  
  if (hasProductKeyword) {
    return searchProducts(""); // Returns all products
  }
  
  return null;
}
```

**Why empty string?**: Since we only have 8 shirts in mock data, we show all products when any product keyword is detected. When Shopify MCP is integrated, this will pass the actual search query.

### Step 3: Product Search

**Location**: `productUtils.ts` - `searchProducts()` function

**Current Behavior**: 
- Empty query → returns all products
- With query → filters by title and description

```typescript
export function searchProducts(query: string): UIProduct[] {
  const products = loadMockProducts();
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return products.map(mapToUIProduct);
  }

  const filtered = products.filter((product) => {
    const titleMatch = product.title.toLowerCase().includes(lowerQuery);
    const descMatch = product.description.toLowerCase().includes(lowerQuery);
    return titleMatch || descMatch;
  });

  return filtered.map(mapToUIProduct);
}
```

### Step 4: Message Update

**Location**: `Chat.tsx` - `processStreamedResponse()` function

After AI response streams in, products are attached to the message:

```typescript
async function processStreamedResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  userQuery: string
) {
  // ... stream processing ...
  
  // Check if the user query was about products
  const products = detectProductQuery(userQuery);
  if (products && products.length > 0) {
    setMessages((prev) => [
      ...prev.slice(0, -1),
      { role: "assistant", content: assistantMessage, products },
    ]);
  }
}
```

**Key Point**: The `Message` interface was extended to include optional `products` array:

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  products?: UIProduct[]; // Added in this session
}
```

### Step 5: Rendering

**Location**: `Chat.tsx` - `renderMessage()` function

Messages with products render both the text and a ProductGrid:

```typescript
function renderMessage(message: Message, index: number) {
  return (
    <div key={index} className='mb-6'>
      {/* Chat bubble with AI response */}
      <div className={...}>
        <strong>{message.role === "user" ? "You: " : "AI: "}</strong>
        <span>{message.content}</span>
      </div>
      
      {/* Product grid appears below if products exist */}
      {message.products && message.products.length > 0 && (
        <div className='mt-4'>
          <ProductGrid
            products={message.products}
            onTryOn={handleTryOn}
            onAddToCart={handleAddToCart}
          />
        </div>
      )}
    </div>
  );
}
```

## Product Display Components

### ProductGrid Component

**Location**: `src/components/ProductGrid.tsx`

**Responsibility**: Layout container for product cards

**Features**:
- Responsive grid: 1 column (mobile), 2 columns (tablet), 3 columns (desktop)
- Empty state handling
- Count display

**Props**:
```typescript
interface ProductGridProps {
  products: UIProduct[];
  onTryOn: (product: UIProduct) => void;
  onAddToCart?: (product: UIProduct) => void; // Optional, Shopify handles
}
```

### ProductCard Component

**Location**: `src/components/ProductCard.tsx`

**Responsibility**: Individual product display with actions

**Key Features**:
1. **Eye Icon** - Top-right absolute positioned button
2. **Product Image** - 48px height, object-cover
3. **Product Info** - Title, description, price
4. **Variants Display** - Shows available sizes
5. **Hover Effects** - Shadow on hover

**Eye Icon Implementation**:
```typescript
{product.overlayAssetUrl && (
  <button
    onClick={() => onTryOn(product)}
    className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white hover:scale-110 transition-all shadow-md"
    title="Try on this item"
  >
    {/* Eye SVG icon */}
  </button>
)}
```

**Key Decision**: Eye icon only shows if `overlayAssetUrl` exists (from metafield `custom.overlay_asset_shirt`). This ensures try-on is only available for products that have try-on assets.

## Data Flow Diagram

```
User Types "show me shirts"
         ↓
Chat.handleSubmit()
         ↓
POST /api/chat (streams AI response)
         ↓
processStreamedResponse()
         ↓
detectProductQuery(userQuery)
         ↓
Check for keywords → Found!
         ↓
searchProducts("") 
         ↓
loadMockProducts() → [8 ShopifyProduct]
         ↓
map(mapToUIProduct) → [8 UIProduct]
         ↓
Return to processStreamedResponse
         ↓
Update message with products array
         ↓
setMessages([..., { content: "...", products: [...] }])
         ↓
renderMessage() called
         ↓
Renders ProductGrid with products
         ↓
ProductGrid maps over products
         ↓
Renders 8 ProductCard components
         ↓
User sees product cards with eye icons
```

## Critical Implementation Details

### 1. Why Inline Mock Data?

Initially attempted to import `mockProducts.json` but encountered module resolution issues. Solution: embed data directly in `productUtils.ts` as a TypeScript constant.

**Advantages**:
- Zero import issues
- Type-safe
- Fast
- Easy to find and modify
- Works in both browser and SSR contexts

### 2. Product Detection Strategy

**Simple but Effective**: Keyword matching on user messages

**Rationale**:
- No complex NLP needed for demo
- Predictable behavior
- Easy to extend keywords
- Works with mock data flow

**Future Enhancement**: When integrated with Shopify MCP, this can be replaced with:
- Function calling / tool use
- More sophisticated intent detection
- Real search API with filters

### 3. Message-Products Relationship

Products are attached **to the message object**, not as separate state. This design:

- ✅ Keeps products contextual to the conversation
- ✅ Products scroll with their related message
- ✅ Supports multiple product queries in one conversation
- ✅ Clear which AI response triggered which products

### 4. Responsive Design

Grid uses Tailwind's responsive classes:
- `grid-cols-1` - Mobile (default)
- `sm:grid-cols-2` - Tablet (640px+)
- `lg:grid-cols-3` - Desktop (1024px+)

This ensures optimal viewing on all devices.

## Integration Points for Shopify MCP

### Replace Mock Data Loading

**Current** (`productUtils.ts`):
```typescript
export function loadMockProducts(): ShopifyProduct[] {
  return MOCK_PRODUCTS;
}
```

**Future** (with MCP):
```typescript
export async function loadProducts(): Promise<ShopifyProduct[]> {
  const response = await fetch('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      tool: 'search_shop_catalog',
      args: { query: '', first: 20 }
    })
  });
  const data = await response.json();
  return data.products;
}
```

### Replace Search Function

**Current**:
```typescript
export function searchProducts(query: string): UIProduct[] {
  // Client-side filtering
}
```

**Future**:
```typescript
export async function searchProducts(query: string): Promise<UIProduct[]> {
  const response = await fetch('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      tool: 'search_shop_catalog',
      args: { query, first: 20 }
    })
  });
  const data = await response.json();
  return data.products.map(mapToUIProduct);
}
```

**Note**: The `mapToUIProduct()` function already handles the Shopify structure correctly, so no changes needed there.

## Performance Considerations

1. **Product Loading**: Currently synchronous (mock data). Will need loading states when async MCP calls are added.

2. **Image Loading**: Product images loaded lazily by browser. Unsplash URLs used for demo (consider CDN for production).

3. **Try-On Generation**: 8-10 seconds average. Modal shows loading spinner during generation.

4. **State Updates**: Using React's batched updates for efficient rendering.

## Error Handling

### Product Loading
- Returns empty array if load fails
- UI shows "No products found" message

### Try-On Generation
- Network errors caught and displayed in modal
- User can retry with "Try Again" button
- Proper error messages for missing selfie

### Image Upload
- File size validation (5MB max)
- File type validation (jpg, png, webp only)
- User-friendly error messages

