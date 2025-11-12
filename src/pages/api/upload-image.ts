import type { APIRoute } from 'astro';
import { getSessionId, storeUploadedImage } from '../../lib/blobStorage';

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    const { image } = body;

    if (!image || typeof image !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Image data is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get or create session
    const sessionId = getSessionId(context);

    // Parse base64 image
    let base64Data: string;
    let contentType: string = 'image/png';

    if (image.startsWith('data:')) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return new Response(
          JSON.stringify({ error: 'Invalid image format' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      contentType = matches[1];
      base64Data = matches[2];
    } else {
      base64Data = image;
    }

    // Convert to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Store in blob
    const imageId = await storeUploadedImage(sessionId, imageBuffer, contentType);

    return new Response(
      JSON.stringify({
        success: true,
        imageId,
        url: `/api/images/${imageId}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error uploading image:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to upload image' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
