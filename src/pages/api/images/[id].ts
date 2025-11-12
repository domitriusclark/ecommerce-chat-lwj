import type { APIRoute } from 'astro';
import { getSessionId, getImage, STORES } from '../../../lib/blobStorage';

export const GET: APIRoute = async (context) => {
  try {
    const { id } = context.params;

    if (!id) {
      return new Response('Image ID is required', { status: 400 });
    }

    const sessionId = getSessionId(context);

    // Try uploaded images first, then generated images
    let result = await getImage(sessionId, id, STORES.UPLOADED_IMAGES);

    if (!result.data) {
      result = await getImage(sessionId, id, STORES.GENERATED_IMAGES);
    }

    if (!result.data) {
      return new Response('Image not found or expired', { status: 404 });
    }

    const contentType = result.metadata?.contentType || 'image/png';

    return new Response(result.data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error retrieving image:', error);
    return new Response('Failed to retrieve image', { status: 500 });
  }
};
