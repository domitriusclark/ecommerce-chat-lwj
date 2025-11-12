# Shopify MCP Integration - Branch Summary

**Branch:** `connect-shopify-mcp`
**Status:** ✅ Ready to merge
**What it does:** Enables AI assistant to search Shopify products in real-time during chat conversations

---

## New Files

### Core Infrastructure
- **`src/pages/api/mcp.ts`** - MCP proxy with JSON-RPC 2.0 + password auth
- **`src/lib/mcp.ts`** - Type-safe helper functions (`searchShopCatalog`, `callMCP`, etc.)
- **`src/lib/map.ts`** - Data mapper (`mapSearchCatalogToUIProducts`)

### Documentation
- **`.env.example`** - Required environment variables
- **`CONTEXT.md`** - Full project documentation
- **`PLANNING.md`** - Feature planning

---

## Modified Files

- **`src/pages/api/chat.ts`**
  - Upgraded to `gpt-4o-mini` for tool calling
  - Added system prompt + tool definitions
  - Implements streaming tool execution
  - Calls `/api/mcp` internally when AI needs product data

- **`tsconfig.json`**
  - Added `"module": "ESNext"` for `import.meta.env` support

---

## Environment Setup

Add to `.env`:
```env
OPENROUTER_API_KEY=your_key_here
STOREFRONT_MCP_ENDPOINT=https://your-store.myshopify.com/api/mcp
SHOPIFY_STOREFRONT_PASSWORD=your_password  # Only if store is password-protected
```

---

## How It Works

```
User: "Show me flannels"
  ↓
AI decides to call search_shop_catalog("flannel")
  ↓
/api/chat intercepts tool call
  ↓
executeSearchCatalog() → POST to /api/mcp
  ↓
MCP proxy authenticates (if needed) + calls Shopify MCP
  ↓
Products returned to AI
  ↓
AI formats results: "Here are 3 flannel shirts I found..."
```

---

## Key Technical Details

**Authentication Flow:**
- Password-protected stores: Auto-authenticates via `/password` endpoint
- Caches `_shopify_essential` cookie
- Auto-retries on token expiration (302 redirects)

**Tool Calling:**
- Detects tool calls via `delta.toolCalls` in streaming chunks
- Accumulates arguments across chunks
- Executes MCP call server-side
- Returns results to AI for natural language formatting

**MCP Protocol:**
- Uses JSON-RPC 2.0 format (not REST)
- Endpoint: `/api/mcp` (not `/.well-known/mcp/storefront`)
- Requires `context` parameter for searches

---

## Testing

```bash
npm run dev
# Visit http://localhost:4321
# Try: "Show me shirts" or "Search for flannel"
```

**Expected console output:**
```
Tool calls detected: 1
Executing search_shop_catalog with args: {"query":"flannel"}
Tool result: {"content":[{"type":"text"...
```

---

## Next Steps (Not Built Yet)

**Phase 3:** ProductGrid component to display results as visual cards instead of text

---

## Known Issues

- Results displayed as text only (no product cards yet)
- Chat history resets on server restart (in-memory)
- Single shared chat session (no user accounts)

---

**Quick Start:**
1. Pull branch
2. Copy `.env.example` → `.env`
3. Add your API keys
4. `npm run dev`
5. Ask AI: "Show me products"
