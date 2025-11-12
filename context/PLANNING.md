## MCP-Powered Ecommerce Chat with Try-On (Shirts First) — Plan

### Goals
* Ship an MCP-powered ecommerce chat UI that can:
    * Search a Shopify store catalog via Storefront MCP.
    * Let users upload a selfie and “try on” shirts.
    * Support multi-model selection (OpenRouter).
* Stable, demo-ready UX in 4 hours.

### Scope (v1)
* Try-on category: shirts (pants optional follow-up).
* MCP tools: search_shop_catalog, search_shop_policies_and_faqs, get_cart, update_cart.
* Result size: top 5 products.
* Overlay metafield for shirts: custom.overlay_asset_shirt (transparent PNG).
* Optional mask metafield: custom.overlay_mask_shirt (alpha mask for blending).

---

## Architecture

### Frontend
* Existing Chat UI (Astro + serverless).
* Add-ons:
    * Model selector (OpenRouter) per-thread.
    * Selfie upload component.
    * Try-on canvas compositor for shirts.
    * ProductGrid results with “Try on” and “View” actions.

### Backend
* Astro serverless proxy: /api/mcp → Shopify Storefront MCP server.
* No auth needed per docs, but some stores may restrict; handle errors gracefully.
* Environment variable:
    * STOREFRONT_MCP_ENDPOINT=https://{store}.myshopify.com/.well-known/mcp/storefront

### MCP Server (Shopify)
* Use tools/list at dev time to discover shape, then call:
    * search_shop_catalog for product search.
    * search_shop_policies_and_faqs for policy Q&A.
    * get_cart / update_cart to manage checkout links.

---

## Data Contracts

### UIProduct (normalized)
* id
* title
* handle?
* url?
* imageUrl?
* price: { amount: number, currencyCode: string }?
* overlayAssetUrl?: string  // from metafield custom.overlay_asset_shirt

### Mapping
* Map search_shop_catalog response to UIProduct[] (slice to 5).
* overlayAssetUrl = metafields.custom.overlay_asset_shirt when present.

---

## Endpoints and Helpers

### Serverless MCP Proxy (Astro)
```ts
// src/pages/api/mcp.ts
import type { APIRoute } from 'astro';

const STOREFRONT_MCP_ENDPOINT = import.meta.env.STOREFRONT_MCP_ENDPOINT;

export const POST: APIRoute = async ({ request }) => {
    try {
        const { tool, args } = await request.json();
        if (!tool) return new Response(JSON.stringify({ error: 'Missing tool' }), { status: 400 });

        const res = await fetch(`${STOREFRONT_MCP_ENDPOINT}/tools/call`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: tool, arguments: args ?? {} }),
        });

        if (!res.ok) {
            const text = await res.text();
            return new Response(JSON.stringify({ error: `MCP error ${res.status}`, detail: text }), { status: 502 });
        }

        const data = await res.json();
        return new Response(JSON.stringify(data), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: 'Proxy error', detail: e?.message }), { status: 500 });
    }
};
```

### Client Helper
```ts
// src/lib/mcp.ts
export async function callMCP<T = any>(tool: string, args?: Record<string, any>): Promise<T> {
    const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool, args }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
```

### Mapper
```ts
// src/lib/map.ts
export type UIProduct = {
    id: string;
    title: string;
    handle?: string;
    url?: string;
    imageUrl?: string;
    price?: { amount: number; currencyCode: string };
    overlayAssetUrl?: string;
};

export function mapSearchCatalogToUIProducts(payload: any): UIProduct[] {
    const products = payload?.products ?? payload?.items ?? [];
    return products.slice(0, 5).map((p: any) => ({
        id: p.id ?? p.gid ?? p.product?.id,
        title: p.title ?? p.product?.title,
        handle: p.handle,
        url: p.url ?? (p.handle ? `/products/${p.handle}` : undefined),
        imageUrl: p.imageUrl ?? p.images?.[0]?.url ?? p.featuredImage?.url,
        price: p.price ?? p.variants?.[0]?.price,
        overlayAssetUrl: p.metafields?.custom?.overlay_asset_shirt ?? p.overlayAssetUrl,
    }));
}
```

---

## Chat Integration

### Function Schema (ShopSearch)
```json
{
    "name": "ShopSearch",
    "description": "Search the store catalog for products",
    "parameters": {
        "type": "object",
        "properties": {
            "q": { "type": "string", "description": "Natural language search like 'men short sleeve shirt blue linen'" },
            "first": { "type": "number", "default": 5 }
        },
        "required": ["q"]
    }
}
```

### Function Handler
```ts
// src/agent/tools.ts
import { callMCP } from '../lib/mcp';
import { mapSearchCatalogToUIProducts } from '../lib/map';

export async function handleShopSearch({ q, first = 5 }: { q: string; first?: number }) {
    const mcpRes = await callMCP('search_shop_catalog', { query: q, first });
    return mapSearchCatalogToUIProducts(mcpRes);
}
```

### System Prompt Fragment
* You can call ShopSearch to find products. Use concise queries (e.g., “men short sleeve shirt blue”).
* Return 3–5 items with title, price, image, URL, overlayAssetUrl when available.
* For store policy questions, only use answers from search_shop_policies_and_faqs.
* If the user uploaded a selfie and an item has overlayAssetUrl, suggest “Try on”.

---

## UI Components

### Model Selector
* Dropdown to pick OpenRouter model; persist per chat thread.
* Fall back to a fast model for tool orchestration if needed.

### ProductGrid
```tsx
// src/components/ProductGrid.tsx
import type { UIProduct } from '../lib/map';

type Props = { products: UIProduct[]; onTryOn: (p: UIProduct) => void };

export function ProductGrid({ products, onTryOn }: Props) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {products.map(p => (
                <div key={p.id} className="border rounded p-2">
                    {p.imageUrl && <img src={p.imageUrl} alt={p.title} className="w-full h-40 object-cover rounded" />}
                    <div className="mt-2 text-sm font-medium">{p.title}</div>
                    {p.price && (
                        <div className="text-xs opacity-80">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: p.price.currencyCode }).format(p.price.amount)}
                        </div>
                    )}
                    <div className="mt-2 flex gap-2">
                        {p.overlayAssetUrl && <button className="btn" onClick={() => onTryOn(p)}>Try on</button>}
                        {p.url && <a className="btn-secondary" href={p.url} target="_blank" rel="noreferrer">View</a>}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

### Selfie Upload
* Accept .jpg/.png up to ~5MB.
* Create object URL, store as selfieUrl.
* Provide “Reset image”.

### Try-On Canvas (Shirts)
```tsx
// src/components/TryOnCanvasShirt.tsx
import { useRef, useState, useEffect } from 'react';

type Props = {
    selfieUrl: string;
    overlayUrl: string;
    maskUrl?: string;
    initial?: { x?: number; y?: number; scale?: number; rot?: number };
};

export function TryOnCanvasShirt({ selfieUrl, overlayUrl, maskUrl, initial }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [transform, setTransform] = useState({
        x: initial?.x ?? 256,
        y: initial?.y ?? 340,
        scale: initial?.scale ?? 1.2,
        rot: initial?.rot ?? 0
    });

    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const bg = new Image();
        const ov = new Image();
        const mk = maskUrl ? new Image() : null;
        let raf = 0;

        bg.crossOrigin = 'anonymous';
        ov.crossOrigin = 'anonymous';
        if (mk) mk.crossOrigin = 'anonymous';
        bg.src = selfieUrl;
        ov.src = overlayUrl;
        if (mk) mk.src = maskUrl!;

        function draw() {
            const { width, height } = canvas;
            ctx.clearRect(0, 0, width, height);
            if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, width, height);

            if (ov.complete && ov.naturalWidth) {
                ctx.save();
                ctx.translate(transform.x, transform.y);
                ctx.rotate(transform.rot);

                const baseW = 480;
                const baseH = 540;
                const w = baseW * transform.scale;
                const h = baseH * transform.scale;

                if (mk && mk.complete && mk.naturalWidth) {
                    const off = document.createElement('canvas');
                    off.width = w; off.height = h;
                    const octx = off.getContext('2d')!;
                    octx.drawImage(ov, 0, 0, w, h);
                    octx.globalCompositeOperation = 'destination-in';
                    octx.drawImage(mk, 0, 0, w, h);
                    ctx.globalAlpha = 0.98;
                    ctx.drawImage(off, -w / 2, -h / 2);
                } else {
                    ctx.globalAlpha = 0.98;
                    ctx.drawImage(ov, -w / 2, -h / 2, w, h);
                }
                ctx.restore();
            }
            raf = requestAnimationFrame(draw);
        }

        const onLoad = () => draw();
        bg.onload = onLoad; ov.onload = onLoad; if (mk) mk.onload = onLoad;
        return () => cancelAnimationFrame(raf);
    }, [selfieUrl, overlayUrl, maskUrl, transform]);

    useEffect(() => {
        const canvas = canvasRef.current!;
        let dragging = false;
        let lastX = 0, lastY = 0;

        const onDown = (e: PointerEvent) => {
            dragging = true;
            lastX = e.clientX; lastY = e.clientY;
            canvas.setPointerCapture(e.pointerId);
        };
        const onMove = (e: PointerEvent) => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX; lastY = e.clientY;
            setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
        };
        const onUp = (e: PointerEvent) => {
            dragging = false;
            canvas.releasePointerCapture(e.pointerId);
        };
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.05 : 0.95;
            setTransform(t => ({ ...t, scale: Math.max(0.3, Math.min(3, t.scale * factor)) }));
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'q') setTransform(t => ({ ...t, rot: t.rot - 0.03 }));
            if (e.key === 'e') setTransform(t => ({ ...t, rot: t.rot + 0.03 }));
            if (e.key === 'ArrowUp') setTransform(t => ({ ...t, y: t.y - 4 }));
            if (e.key === 'ArrowDown') setTransform(t => ({ ...t, y: t.y + 4 }));
            if (e.key === 'ArrowLeft') setTransform(t => ({ ...t, x: t.x - 4 }));
            if (e.key === 'ArrowRight') setTransform(t => ({ ...t, x: t.x + 4 }));
        };

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('keydown', onKey);

        return () => {
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('wheel', onWheel);
            window.removeEventListener('keydown', onKey);
        };
    }, []);

    function autoFit() {
        const canvas = canvasRef.current!;
        const targetW = canvas.width * 0.6;
        const baseW = 480;
        const scale = targetW / baseW;
        setTransform(t => ({ ...t, scale, x: canvas.width / 2, y: canvas.height * 0.55 }));
    }

    return (
        <div className="space-y-2">
            <canvas ref={canvasRef} width={512} height={680} className="w-full border rounded" />
            <div className="flex gap-2">
                <button className="btn" onClick={autoFit}>Auto fit</button>
                <button className="btn-secondary" onClick={() => setTransform(t => ({ ...t, rot: 0 }))}>Reset rotation</button>
            </div>
            <p className="text-xs opacity-70">Tips: drag to move, mouse wheel to resize, Q/E to rotate, arrow keys to nudge.</p>
        </div>
    );
}
```

### Minimal Try-On Flow
* User uploads selfie → selfieUrl stored globally.
* Chat search returns products → ProductGrid renders.
* Click “Try on” → modal with TryOnCanvasShirt using product.overlayAssetUrl.

---

## Prompting Guidelines

### Assistant Behaviors
* For shirt queries, call ShopSearch with focused terms, e.g.:
    * “men short sleeve shirt blue”
    * “women linen shirt white”
    * “oxford shirt slim fit”
* Return a concise list (3–5) and mention “Try on” when available.
* For policies, call search_shop_policies_and_faqs and cite only that answer.
* If cart requested, call update_cart then get_cart to present a checkout URL.

---

## Execution Plan (4 Hours)

### 1) Foundation (45 min)
* Wire OpenRouter model selector.
* Add /api/mcp proxy and .env.
* Test search_shop_catalog call manually from a dev button.

### 2) Chat Tools & Rendering (45 min)
* Add ShopSearch function and handler.
* Normalize results → UIProduct → ProductGrid.
* Loading and error states.

### 3) Selfie + Try-On (75 min)
* SelfieUpload component with preview, object URL.
* TryOnCanvasShirt with manual controls and Auto fit.
* Modal wrapper + “Try on” buttons.

### 4) Shopify Metafields + Polishing (30–45 min)
* Ensure at least a few products have custom.overlay_asset_shirt URLs.
* If cart needed: basic “Add to cart” via update_cart and show checkout URL from get_cart.
* Deploy (Vercel/Netlify), verify env.

---

## Risks and Mitigations
* Missing overlay assets:
    * Add a demo PNG and attach to a handful of shirts via metafield for the demo.
* MCP endpoint restrictions:
    * Test store endpoint early; add clear error messaging and a fallback static mock if needed.
* Latency/model switching:
    * Cache last results in UI; default to a fast model for tool calls.

---

## Next Steps (Nice-to-haves)
* Pants try-on: add custom.overlay_asset_pants and a second canvas preset.
* Landmark-based auto-placement (MediaPipe Face Mesh/BlazePose).
* “Compare” two items side-by-side.
* Quick add-to-cart with variant selection and persistent cart state.

---

## Checklist
* Configure STOREFRONT_MCP_ENDPOINT.
* Verify search_shop_catalog returns expected fields.
* Add overlay metafield custom.overlay_asset_shirt to a few products.
* Wire ShopSearch function and ProductGrid.
* Implement SelfieUpload and TryOnCanvasShirt.
* Ship!

