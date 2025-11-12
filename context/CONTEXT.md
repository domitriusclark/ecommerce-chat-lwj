# Ecommerce Chat with Virtual Try-On — Project Context

## Project Overview
An MCP-powered ecommerce chat interface built with Astro, React, and OpenRouter that enables users to search a Shopify catalog, chat with AI, and virtually try on clothing items (starting with shirts) using selfie uploads.

**Timeline:** 4-hour MVP
**Status:** Foundation complete, ready for MCP integration and try-on features

---

## Current Architecture

### Tech Stack
- **Framework:** Astro 5.3.0 (SSR mode with Netlify adapter)
- **UI:** React 19 with Tailwind CSS 4
- **AI:** OpenRouter SDK (`@openrouter/sdk`) for multi-model chat
- **Deployment:** Netlify (serverless functions via Astro API routes)

### Existing Components

#### 1. Chat Interface ([src/components/Chat.tsx](src/components/Chat.tsx))
- **Features:**
  - Message history with user/assistant roles
  - Streaming response support
  - New conversation management
  - Loading states and error handling
- **API Integration:** `/api/chat` endpoint
- **State Management:** React hooks with in-memory message storage

#### 2. Chat API Route ([src/pages/api/chat.ts](src/pages/api/chat.ts))
- **Endpoint:** `POST /api/chat`
- **Provider:** OpenRouter SDK with streaming
- **Model:** `openai/gpt-3.5-turbo` (configurable)
- **Storage:** In-memory chat history (Map-based, needs persistence layer)
- **Environment:** Uses `import.meta.env.OPENROUTER_API_KEY`

#### 3. Layout & Styling
- **Layout:** [src/layouts/Layout.astro](src/layouts/Layout.astro) - Simple centered layout
- **Styles:** [src/styles/global.css](src/styles/global.css) - Tailwind-based
- **Main Page:** [src/pages/index.astro](src/pages/index.astro) - Renders Chat component

### Configuration
```javascript
// astro.config.mjs
{
  output: 'server',
  adapter: netlify(),
  integrations: [react()],
  vite: { plugins: [tailwindcss()] }
}
```

### Environment Variables
```env
OPENROUTER_API_KEY=<your-key>
STOREFRONT_MCP_ENDPOINT=https://your-store.myshopify.com/api/mcp
SHOPIFY_STOREFRONT_PASSWORD=<optional-password>  # Only needed for password-protected stores
SHOPIFY_STOREFRONT_ACCESS_TOKEN=<storefront-access-token>  # Required for checkout/cart mutations
```

**Notes:**
- Shopify MCP uses JSON-RPC 2.0 protocol, not REST
- The endpoint is `/api/mcp` (not `/.well-known/mcp/storefront`)
- Development stores often have password protection enabled
- The proxy automatically authenticates using the storefront password and caches the token

---

## Planned Features (from PLANNING.md)

### Phase 1: MCP Integration (45 min)
**Goal:** Connect to Shopify Storefront MCP for catalog search

#### 1.1 MCP Proxy API Route
- **File:** `src/pages/api/mcp.ts`
- **Purpose:** Proxy MCP tool calls to Shopify Storefront server
- **Tools to support:**
  - `search_shop_catalog` - Product search
  - `search_shop_policies_and_faqs` - Policy Q&A
  - `get_cart` / `update_cart` - Cart management

#### 1.2 Client Helper Library
- **File:** `src/lib/mcp.ts`
- **Function:** `callMCP(tool, args)` - Typed MCP client wrapper

#### 1.3 Model Selector UI
- Add dropdown to Chat component for OpenRouter model selection
- Persist model choice per thread
- Default: fast model for tool orchestration

---

### Phase 2: Product Search & Display (45 min)
**Goal:** Enable AI to search catalog and display products

#### 2.1 Data Types & Mapping
- **File:** `src/lib/map.ts`
- **Type:** `UIProduct` interface
  ```typescript
  {
    id: string;
    title: string;
    handle?: string;
    url?: string;
    imageUrl?: string;
    price?: { amount: number; currencyCode: string };
    overlayAssetUrl?: string;  // from metafield custom.overlay_asset_shirt
  }
  ```
- **Mapper:** `mapSearchCatalogToUIProducts(mcpResponse) => UIProduct[]`
  - Normalizes MCP response to UIProduct array
  - Slices to top 5 results
  - Extracts overlay asset from metafields

#### 2.2 ShopSearch Tool Integration
- **File:** `src/agent/tools.ts`
- **Function:** `handleShopSearch({ q, first })`
  - Calls MCP `search_shop_catalog`
  - Maps to UIProduct array
- **Function Schema (for AI):**
  ```json
  {
    "name": "ShopSearch",
    "description": "Search the store catalog for products",
    "parameters": {
      "q": "Natural language query (e.g. 'men blue linen shirt')",
      "first": 5
    }
  }
  ```

#### 2.3 ProductGrid Component
- **File:** `src/components/ProductGrid.tsx`
- **Props:** `{ products: UIProduct[], onTryOn: (p) => void }`
- **Features:**
  - Grid layout (2-3 columns)
  - Product image, title, price display
  - "Try on" button (if overlayAssetUrl exists)
  - "View" link to product page

#### 2.4 Update Chat Component
- Render ProductGrid when AI returns search results
- Handle loading/error states for MCP calls
- Display "Try on" option when selfie + overlay available

---

### Phase 3: Virtual Try-On (75 min)
**Goal:** Let users upload selfies and try on shirt overlays

#### 3.1 Selfie Upload Component
- **File:** `src/components/SelfieUpload.tsx`
- **Features:**
  - File input (jpg/png, max 5MB)
  - Image preview with object URL
  - "Reset image" button
  - Store `selfieUrl` in parent state

#### 3.2 Try-On Canvas Component
- **File:** `src/components/TryOnCanvasShirt.tsx`
- **Props:**
  ```typescript
  {
    selfieUrl: string;
    overlayUrl: string;
    maskUrl?: string;  // optional alpha mask
    initial?: { x, y, scale, rot };  // initial transform
  }
  ```
- **Features:**
  - Canvas-based compositor (512x680)
  - Background: user's selfie
  - Overlay: shirt PNG with transparency
  - Optional mask for advanced blending
- **Controls:**
  - Drag to move overlay
  - Mouse wheel to scale
  - Q/E keys to rotate
  - Arrow keys to nudge
  - "Auto fit" button (smart positioning)
  - "Reset rotation" button
- **Rendering:**
  - Layer selfie as background
  - Apply overlay with transform (translate, rotate, scale)
  - Use `destination-in` composite op if mask provided
  - Global alpha 0.98 for realism

#### 3.3 Try-On Modal/Flow
- **Trigger:** Click "Try on" button in ProductGrid
- **Behavior:**
  - Open modal/overlay with TryOnCanvasShirt
  - Pass product.overlayAssetUrl
  - Allow user to adjust fit
  - "Save" button to export canvas as image (optional)
  - "Close" to return to chat

#### 3.4 Integration with Chat
- Store selfie globally (e.g., ChatContext or parent state)
- AI mentions "Try on" availability when:
  - User has uploaded selfie
  - Product has overlayAssetUrl
- System prompt update to suggest try-on feature

---

### Phase 4: Polish & Deploy (30-45 min)

#### 4.1 Shopify Metafield Setup
- **Required metafield:** `custom.overlay_asset_shirt`
  - Type: URL (string)
  - Value: Public URL to transparent PNG overlay asset
- **Optional metafield:** `custom.overlay_mask_shirt`
  - Type: URL (string)
  - Value: Alpha mask for advanced blending
- **Action:** Add metafields to 3-5 demo products in Shopify admin

#### 4.2 Cart Functionality (Optional)
- Add "Add to cart" button in ProductGrid
- Call `update_cart` MCP tool with product variant ID
- Retrieve checkout URL with `get_cart`
- Display checkout link to user

#### 4.3 System Prompt Refinement
- **Behavior guidelines for AI:**
  - Use ShopSearch for product queries with concise terms
  - Return 3-5 products max per search
  - Suggest "Try on" when selfie + overlay available
  - For policy questions, only cite `search_shop_policies_and_faqs` results
  - For cart actions, use `update_cart` → `get_cart` flow

#### 4.4 Deployment Checklist
- [ ] Set `OPENROUTER_API_KEY` in Netlify env
- [ ] Set `STOREFRONT_MCP_ENDPOINT` in Netlify env
- [ ] Test MCP endpoint connectivity
- [ ] Verify overlay assets are accessible (CORS)
- [ ] Deploy to Netlify
- [ ] Smoke test: search → try-on → cart flow

---

## Data Flow Diagrams

### Product Search Flow
```
User: "Show me blue linen shirts"
  ↓
Chat Component → /api/chat
  ↓
OpenRouter (with ShopSearch tool)
  ↓
handleShopSearch() → /api/mcp
  ↓
Shopify MCP: search_shop_catalog
  ↓
mapSearchCatalogToUIProducts()
  ↓
ProductGrid renders results
  ↓
User clicks "Try on"
```

### Try-On Flow
```
User uploads selfie → SelfieUpload
  ↓ (stores selfieUrl in state)
User searches products → ProductGrid
  ↓
Click "Try on" (product with overlayAssetUrl)
  ↓
Open TryOnCanvasShirt modal
  ↓ (render: selfie bg + overlay fg)
User adjusts fit (drag, scale, rotate)
  ↓
Optional: Export canvas as image
  ↓
Close modal, return to chat
```

---

## File Structure (Planned)

```
ecommerce-chat-lwj/
├── src/
│   ├── components/
│   │   ├── Chat.tsx              # ✅ Existing - streaming chat UI
│   │   ├── ProductGrid.tsx       # 🔨 To build - product display
│   │   ├── SelfieUpload.tsx      # 🔨 To build - selfie input
│   │   └── TryOnCanvasShirt.tsx  # 🔨 To build - virtual try-on
│   ├── pages/
│   │   ├── index.astro           # ✅ Existing - main page
│   │   └── api/
│   │       ├── chat.ts           # ✅ Existing - OpenRouter chat
│   │       └── mcp.ts            # 🔨 To build - MCP proxy
│   ├── lib/
│   │   ├── mcp.ts                # 🔨 To build - MCP client helper
│   │   └── map.ts                # 🔨 To build - data mappers
│   ├── agent/
│   │   └── tools.ts              # 🔨 To build - AI tool handlers
│   ├── layouts/
│   │   └── Layout.astro          # ✅ Existing
│   └── styles/
│       └── global.css            # ✅ Existing
├── astro.config.mjs              # ✅ Configured (SSR + Netlify)
├── package.json                  # ✅ Dependencies installed
├── PLANNING.md                   # 📄 Original plan
├── CONTEXT.md                    # 📄 This file
└── README.md                     # 📄 To update
```

---

## Technical Decisions & Rationale

### Why OpenRouter?
- Multi-model support (let user choose model)
- Official TypeScript SDK with streaming
- Unified API for tool calling across providers

### Why Astro?
- Server-side rendering for SEO
- Built-in API routes (no separate backend)
- Great DX with island architecture for React components
- Netlify adapter for easy deployment

### Why Canvas for Try-On?
- Full control over compositing and transforms
- No external dependencies (Web APIs only)
- Real-time interactive adjustments
- Export capability for sharing

### Why MCP?
- Standard protocol for AI-tool integration
- Shopify provides official Storefront MCP server
- Extensible for future tools (inventory, orders, etc.)

---

## Known Limitations & TODOs

### Current Limitations
1. **Chat history storage:** In-memory only (resets on server restart)
   - **Future:** Use Netlify Blobs or external DB
2. **No user authentication:** Single shared chat thread
   - **Future:** Add user sessions with cookie/JWT
3. **Overlay assets:** Must be manually added as metafields
   - **Future:** Auto-generate overlays or use marketplace
4. **Try-on accuracy:** Manual positioning only
   - **Future:** Use MediaPipe for landmark detection

### Immediate TODOs (for MVP)
- [ ] Implement `/api/mcp` proxy endpoint
- [ ] Create `callMCP()` client helper
- [ ] Build `mapSearchCatalogToUIProducts()` mapper
- [ ] Add ShopSearch tool to chat agent
- [ ] Build ProductGrid component
- [ ] Build SelfieUpload component
- [ ] Build TryOnCanvasShirt component
- [ ] Integrate try-on modal in Chat
- [ ] Add overlay metafields to demo products
- [ ] Update system prompt for AI behavior
- [ ] Deploy and test end-to-end

### Nice-to-Haves (Post-MVP)
- Pants try-on with different overlay positioning
- Landmark-based auto-fit using ML
- Side-by-side comparison view
- Quick add-to-cart with variant selection
- Persistent cart state across sessions
- Share try-on results (social media export)

---

## API Contracts

### MCP Proxy Endpoint

**POST /api/mcp**
```typescript
Request: {
  tool: string;        // e.g., "search_shop_catalog"
  args?: object;       // tool-specific arguments
}

Response: {
  // MCP tool response (varies by tool)
  // Or error: { error: string, detail?: string }
}
```

### Chat Endpoint

**POST /api/chat**
```typescript
Request: {
  message?: string;           // user message
  newConversation?: boolean;  // reset chat history
}

Response: StreamingResponse | ErrorResponse
```

---

## AI Prompting Strategy

### System Prompt (Updated for MCP)
```
You are a helpful shopping assistant for an online clothing store.

Available Tools:
- ShopSearch(q: string, first?: number): Search the catalog. Use focused queries like "men blue linen shirt" or "women oxford shirt white". Returns up to 5 products with title, price, image, and try-on overlay (if available).
- search_shop_policies_and_faqs: Answer policy questions. Only cite results from this tool.
- update_cart + get_cart: Add items to cart and retrieve checkout URL.

Behaviors:
- For product searches, use ShopSearch with concise, natural language queries.
- Return 3-5 products max per response.
- If user uploaded a selfie and product has overlayAssetUrl, mention "Try on" option.
- For policies, only answer using search_shop_policies_and_faqs results.
- If user asks to add to cart, use update_cart then get_cart to provide checkout link.
- Be concise, friendly, and focus on helping users find what they need.
```

---

## Development Workflow

### Starting the Dev Server
```bash
npm run dev
# Astro dev server on http://localhost:4321
```

### Environment Setup
1. Copy `.env.example` to `.env` (if exists)
2. Set `OPENROUTER_API_KEY` from https://openrouter.ai/settings/keys
3. Set `STOREFRONT_MCP_ENDPOINT` from Shopify store settings

### Testing MCP Integration
```bash
# Manual test of MCP endpoint
curl -X POST http://localhost:4321/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"search_shop_catalog","args":{"query":"blue shirt","first":5}}'
```

### Building for Production
```bash
npm run build
# Output: dist/ (Netlify serverless)
```

---

## Resources & References

### Documentation
- [Astro Docs](https://docs.astro.build)
- [OpenRouter API](https://openrouter.ai/docs)
- [Shopify Storefront MCP](https://shopify.dev/docs/api/storefront-mcp)
- [MCP Protocol Spec](https://modelcontextprotocol.io)

### Assets Needed
- **Shirt overlay templates:** Transparent PNG files (480x540 recommended)
- **Optional masks:** Alpha channel masks for realistic blending
- **Demo products:** At least 3-5 shirts with overlay metafields

### Deployment
- **Platform:** Netlify
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Environment variables:** Set in Netlify dashboard

---

## Success Criteria

### MVP Complete When:
1. ✅ User can chat with AI via OpenRouter
2. ⏳ User can search Shopify catalog via MCP
3. ⏳ AI returns 3-5 products with images and prices
4. ⏳ User can upload a selfie
5. ⏳ User can click "Try on" to see overlay on selfie
6. ⏳ User can adjust overlay position/scale/rotation
7. ⏳ Deployed to Netlify with working end-to-end flow

### Demo Script
1. Open chat, select model
2. Upload selfie
3. Ask: "Show me blue linen shirts for men"
4. View 5 products in grid
5. Click "Try on" on first product
6. Adjust fit in canvas (drag, scale, rotate)
7. Close modal, ask follow-up question
8. Add item to cart (optional)
9. Get checkout link

---

## Questions for Stakeholders

- Which Shopify store will we use for demo?
- Do we have overlay assets, or do we need to create them?
- Should we support multiple try-on items per session (e.g., shirt + pants)?
- Do we need user authentication, or is anonymous OK for demo?
- What's the expected traffic/load for initial launch?

---

*This document should be updated as features are implemented and requirements evolve.*
