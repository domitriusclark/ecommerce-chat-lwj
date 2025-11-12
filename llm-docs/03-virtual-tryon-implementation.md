# Virtual Try-On Implementation

## Architecture Overview

The virtual try-on feature uses Google's Gemini 2.5 Flash Image model via OpenRouter to generate photorealistic images of users wearing selected clothing items.

## Component Flow

```
User uploads selfie
       ↓
SelfieUpload → setSelfieImage(base64)
       ↓
User clicks eye icon on product
       ↓
handleTryOn(product) checks for selfie
       ↓
Opens TryOnModal
       ↓
Modal auto-calls generateTryOn()
       ↓
POST /api/tryon with selfie + product image
       ↓
OpenRouter Gemini 2.5 Flash Image
       ↓
Returns base64 PNG in message.images[0]
       ↓
Display in modal with tabs
```

## Selfie Upload Component

**Location**: `src/components/SelfieUpload.tsx`

### Key Features

1. **File Validation**:
   - Max size: 5MB
   - Allowed types: jpg, png, webp
   - Client-side validation before processing

2. **Base64 Conversion**:
   - Uses FileReader API
   - Converts to data URL format
   - Stored in parent component state

3. **Preview Display**:
   - 64px circular thumbnail
   - Shows when image selected
   - "Remove" button to clear

4. **User Feedback**:
   - Loading state during upload
   - Error messages for validation failures
   - Visual confirmation when uploaded

### Implementation Details

```typescript
const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate
  if (!validateImageType(file)) {
    setError('Please upload a valid image file (JPEG, PNG, or WebP)');
    return;
  }

  if (!validateImageSize(file)) {
    setError('Image size must be less than 5MB');
    return;
  }

  // Convert and pass up
  const base64 = await fileToBase64(file);
  onImageSelected(base64);
};
```

## Try-On Modal Component

**Location**: `src/components/TryOnModal.tsx`

### State Management

```typescript
const [compositeImage, setCompositeImage] = useState<string | null>(null);
const [isGenerating, setIsGenerating] = useState(false);
const [error, setError] = useState<string | null>(null);
const [activeTab, setActiveTab] = useState<'original' | 'product' | 'tryon'>('tryon');
```

### Auto-Generation on Open

```typescript
useEffect(() => {
  if (isOpen && !compositeImage && !isGenerating) {
    generateTryOn();
  }
}, [isOpen]);
```

**Why?**: Automatically starts generation when modal opens, providing immediate feedback.

### API Call Flow

```typescript
const generateTryOn = async () => {
  setIsGenerating(true);
  
  // Convert product image URL to base64 if needed
  let productImageBase64 = product.imageUrl;
  if (product.imageUrl && !product.imageUrl.startsWith("data:")) {
    productImageBase64 = await urlToBase64(product.imageUrl);
  }

  // Call try-on API
  const response = await fetch("/api/tryon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selfieImage,
      productImage: productImageBase64,
      productTitle: product.title,
    }),
  });

  const data = await response.json();
  
  if (data.compositeImage) {
    setCompositeImage(data.compositeImage);
    setActiveTab("tryon");
  }
};
```

### Tabbed Interface

Three tabs for comparison:

1. **Try-On Result**: Shows generated composite image
2. **Your Photo**: Shows original selfie
3. **Product**: Shows product image

This allows users to compare the result with source images.

### Download Feature

```typescript
const handleDownload = () => {
  const link = document.createElement('a');
  link.href = compositeImage;
  link.download = `tryon-${product.title.replace(/\s+/g, '-').toLowerCase()}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

## Try-On API Endpoint

**Location**: `src/pages/api/tryon.ts`

### Request Format

```typescript
POST /api/tryon
{
  "selfieImage": "data:image/jpeg;base64,...",
  "productImage": "data:image/jpeg;base64,...",
  "productTitle": "Classic White Oxford Shirt"
}
```

### OpenRouter Integration

**Model**: `google/gemini-2.5-flash-image`

**Why Direct API Call?**: OpenRouter SDK had Zod validation issues with multi-modal content (text + images).

**Request Structure**:
```typescript
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": request.headers.get("referer") || "http://localhost:4321",
    "X-Title": "Virtual Try-On App",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash-image",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: selfieBase64 } },
        { type: "image_url", image_url: { url: productBase64 } }
      ]
    }]
  })
});
```

### Prompt Engineering

**Critical Challenge**: Ensure model uses visual product image, not text title

**Solution**: Prompt explicitly emphasizes visual over text:

```
Generate a photorealistic image of the person from the first image 
wearing the EXACT clothing item shown in the second image.

CRITICAL: Look at the second image carefully and use the EXACT clothing 
item you see there - the exact color, style, pattern, and design. 
Ignore any text descriptions and only use what you visually see in 
the second image.
```

**Context-Aware Backgrounds**: Prompt includes instructions for theme-based backgrounds:

```
BACKGROUND & CONTEXT - IMPORTANT:
If the user mentioned a specific purpose, event, or setting:
- Office/Work: Professional office setting
- Wedding/Formal: Elegant venue
- Casual/Weekend: Relaxed outdoor setting
- Date: Romantic restaurant
- Interview: Professional background
- Party/Social: Social gathering environment
```

**Why This Matters**: Users can say "I need a shirt for work" and get generated images in office settings, making the try-on more contextual and useful.

### Response Extraction

**Challenge**: The response structure is non-standard for image generation.

**Response Structure**:
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "",  // Empty!
      "images": [{    // Image is here
        "type": "image_url",
        "image_url": {
          "url": "data:image/png;base64,iVBORw0KGgo..." // 2MB+ base64 PNG
        },
        "index": 0
      }]
    }
  }]
}
```

**Extraction Code**:
```typescript
const message = data.choices?.[0]?.message;

if (message.images && Array.isArray(message.images) && message.images.length > 0) {
  const firstImage = message.images[0];
  
  if (firstImage.image_url && firstImage.image_url.url) {
    compositeImage = firstImage.image_url.url;
  }
}
```

**Key Learning**: The generated image is at `message.images[0].image_url.url`, NOT in `message.content`. This was discovered through iterative debugging with structured logging.

### Response Format

```typescript
{
  "success": true,
  "compositeImage": "data:image/png;base64,...",  // Ready to display
  "originalSelfie": "data:image/jpeg;base64,...",
  "originalProduct": "data:image/jpeg;base64,..."
}
```

## Image Processing Utilities

**Location**: `src/lib/imageUtils.ts`

### Key Functions

1. **fileToBase64**: Convert File object → base64 data URL
2. **urlToBase64**: Fetch remote image → base64 data URL
3. **validateImageSize**: Check file size ≤ 5MB
4. **validateImageType**: Check mime type is jpg/png/webp
5. **compressImage**: Optional image compression (not currently used)

### Why Base64?

- **Direct embedding**: Can be passed directly to OpenRouter
- **No CORS issues**: Avoid cross-origin image loading problems
- **Self-contained**: API request contains everything needed
- **Browser-ready**: Can be set directly as img src

## Performance Characteristics

### Try-On Generation Time

- **Average**: 8-10 seconds
- **Factors**: Image size, model load, network latency
- **User Feedback**: Spinner with "This may take 10-15 seconds" message

### Image Sizes

- **Input selfie**: Typically 50-500KB (after base64 encoding ~33% larger)
- **Product image**: Fetched and converted, typically 100-300KB
- **Output composite**: 2-3MB PNG (high quality from Gemini)

### Network Considerations

- **Single API call**: All data sent in one request
- **Streaming not used**: Would complicate base64 transfer
- **Timeout handling**: Could be added for very slow generations

## Error Scenarios

### Missing Selfie

```typescript
function handleTryOn(product: UIProduct) {
  if (!selfieImage) {
    alert("Please upload your photo first to use the virtual try-on feature!");
    return;
  }
  // ... proceed
}
```

### API Failures

Modal shows:
- Error icon (red exclamation)
- Error message
- "Try Again" button to retry

### Invalid Product

Eye icon only appears if `product.overlayAssetUrl` exists, preventing try-on on products without proper metadata.

## Future Enhancements

### Potential Improvements

1. **Camera Capture**: Add webcam option instead of file upload
2. **Multiple Angles**: Generate front, side, back views
3. **Size Recommendations**: Use body measurements from image analysis
4. **Comparison View**: Side-by-side of multiple try-ons
5. **Social Sharing**: Share try-on images directly
6. **Caching**: Cache generated images to avoid regeneration
7. **Progress Indicator**: Show percentage for long generations
8. **Batch Try-On**: Try on multiple items at once

### Alternative Approaches Considered

1. **Canvas Overlay Method**: Manual positioning of transparent PNGs
   - Pros: Instant, no API cost
   - Cons: Not realistic, requires manual adjustment
   - Status: Not implemented (opted for AI generation)

2. **Dedicated Try-On APIs**: Services like Revery.ai
   - Pros: Specialized for clothing, better quality
   - Cons: Additional service, cost, integration complexity
   - Status: Not pursued (OpenRouter sufficient for MVP)

3. **Stable Diffusion / DALL-E**: Alternative image generation
   - Pros: Different style options
   - Cons: Different API, potentially more expensive
   - Status: Not pursued (Gemini working well)

## Testing Recommendations

### Test Cases

1. **Various Selfie Types**:
   - Full body vs headshot
   - Different poses
   - Different backgrounds
   - Different lighting conditions

2. **Various Products**:
   - Different colors (verify accurate color matching)
   - Different patterns (plaid, stripes, solid)
   - Different styles (formal, casual, athletic)

3. **Context Scenarios**:
   - "I need this for work"
   - "For a wedding"
   - No context mentioned

4. **Error Cases**:
   - No selfie uploaded
   - Invalid image files
   - Very large images (>5MB)
   - Network timeout

### Expected Results

- Generated image matches product's visual appearance
- Colors are accurate to product image
- Patterns preserved correctly
- Person's face and body proportions maintained
- Background matches mentioned context
- Natural lighting and shadows

