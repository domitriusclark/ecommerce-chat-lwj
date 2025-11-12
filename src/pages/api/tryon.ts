import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const apiKey = import.meta.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { selfieImage, productImage, productTitle, userContext } =
      await request.json();

    if (!selfieImage || !productImage) {
      return new Response(
        JSON.stringify({
          error: "Both selfieImage and productImage are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Construct the prompt for virtual try-on
    // Important: Focus on the visual product image, not the title
    const contextSection = userContext
      ? `\n\nUSER'S CONTEXT: "${userContext}"\nUse this context to generate an appropriate background and setting. Be creative and authentic to this specific scenario.`
      : "";

    const prompt = `Generate a photorealistic image of the person from the first image wearing the EXACT clothing item shown in the second image.

CRITICAL: Look at the second image carefully and use the EXACT clothing item you see there - the exact color, style, pattern, and design. Ignore any text descriptions and only use what you visually see in the second image.

Instructions:
- Use the EXACT clothing item from the second image (exact colors, patterns, style)
- Naturally fit the clothing onto the person's body
- Make the clothing look natural and properly fitted${contextSection}

BACKGROUND & CONTEXT - ADAPTIVE & DYNAMIC:
Analyze the context from any conversation or details about where/when this clothing will be worn. Look for ANY mention of:
- Events (birthday party, wedding, conference, concert, picnic, etc.)
- Settings (office, outdoors, restaurant, home, beach, etc.)
- Activities (meeting, playing, dancing, shopping, traveling, etc.)
- Time of day or atmosphere (morning coffee, evening dinner, casual weekend, etc.)
- Social context (with kids, professional meeting, date night, family gathering, etc.)

Generate a background and environment that authentically represents that specific context. Be creative and specific - if it's a "kids birthday party", show a colorful party setting with balloons and decorations. If it's a "beach vacation", show a beach backdrop. If it's "working from home", show a home office setting.

If NO specific context is mentioned, create a clean, neutral background that lets the clothing be the focus while still feeling natural and contextual to the clothing style.

The background should feel like a real photograph taken in that environment, not a studio backdrop. Make the lighting, pose, and setting all work together to tell the story of where this person would actually wear this clothing.`;

    // Prepare images - ensure they're in proper base64 format
    const selfieBase64 = selfieImage.startsWith("data:")
      ? selfieImage
      : `data:image/jpeg;base64,${selfieImage}`;
    const productBase64 = productImage.startsWith("data:")
      ? productImage
      : `data:image/jpeg;base64,${productImage}`;

    // Call OpenRouter with image generation model using SDK
    // We need to send images as base64 strings directly since SDK has validation issues
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            request.headers.get("referer") || "http://localhost:4321",
          "X-Title": "Virtual Try-On App",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: selfieBase64,
                  },
                },
                {
                  type: "image_url",
                  image_url: {
                    url: productBase64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter API error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();

    // Extract the generated image from the response
    const message = data.choices?.[0]?.message;

    if (!message) {
      throw new Error("No message in response");
    }

    // The generated image is in message.images[0].image_url.url
    let compositeImage: string | null = null;

    if (
      message.images &&
      Array.isArray(message.images) &&
      message.images.length > 0
    ) {
      const firstImage = message.images[0];

      if (firstImage.image_url && firstImage.image_url.url) {
        compositeImage = firstImage.image_url.url;
      }
    }

    if (!compositeImage) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not extract generated image",
          detail:
            "The model response did not contain a generated image in the expected format.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        compositeImage,
        originalSelfie: selfieImage,
        originalProduct: productImage,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to generate try-on image",
        detail: error?.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
