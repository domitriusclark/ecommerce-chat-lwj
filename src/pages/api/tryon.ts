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

    const { selfieImage, productImage, productTitle } = await request.json();

    if (!selfieImage || !productImage) {
      return new Response(
        JSON.stringify({
          error: "Both selfieImage and productImage are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Construct the prompt for virtual try-on
    const prompt = `Generate a photorealistic image of this person wearing the ${
      productTitle || "shirt"
    } shown in the second image. 
    
Instructions:
- Naturally fit the shirt onto the person's body
- Put them in different poses with backgrounds that are different from the original photo
- Make sure the clothing looks natural and properly fitted
- The result should look like a real photograph, not a composite

Create a seamless, realistic result where it looks like the person is actually wearing this clothing item. If the user says what the shirt is for, use that
information to generate a theme based on that. For example, if they said they wanted a shirt for an office setting, generate a photo of them in an office setting.`;

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
