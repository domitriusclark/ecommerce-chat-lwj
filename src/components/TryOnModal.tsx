import { useState, useEffect } from "react";
import type { UIProduct } from "../types/product";
import { urlToBase64 } from "../lib/imageUtils";

interface TryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: UIProduct;
  selfieImageUrl: string;
  conversationId?: string;
  onAddToCart: (product: UIProduct) => void;
}

export default function TryOnModal({
  isOpen,
  onClose,
  product,
  selfieImageUrl,
  conversationId,
  onAddToCart,
}: TryOnModalProps) {
  const [compositeImage, setCompositeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"original" | "product" | "tryon">(
    "tryon"
  );

  useEffect(() => {
    if (isOpen && !compositeImage && !isGenerating) {
      generateTryOn();
    }
  }, [isOpen]);

  const generateTryOn = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Convert product and selfie image URLs to base64
      let productImageBase64 = product.imageUrl;
      if (product.imageUrl && !product.imageUrl.startsWith("data:")) {
        try {
          productImageBase64 = await urlToBase64(product.imageUrl);
        } catch (err) {
          console.warn(
            "Failed to convert product image to base64, using URL directly"
          );
        }
      }

      let selfieImageBase64 = selfieImageUrl;
      if (selfieImageUrl && !selfieImageUrl.startsWith("data:")) {
        selfieImageBase64 = await urlToBase64(selfieImageUrl);
      }

      const response = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfieImage: selfieImageBase64,
          productImage: productImageBase64,
          productTitle: product.title,
          productId: product.id,
          conversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate try-on");
      }

      const data = await response.json();

      // Check if we got an actual image or just a message
      const generatedImage =
        data.generatedImageUrl || data.compositeImage || null;

      if (generatedImage) {
        setCompositeImage(generatedImage);
        setActiveTab("tryon");
      } else if (data.shouldRetry) {
        // Rate limit error - show user-friendly message
        setError(
          `${data.error}: ${data.detail}\n\nPlease wait a few minutes before trying again.`
        );
      } else if (data.message) {
        // Model returned a description instead of an image
        setError(`${data.message}\n\n${data.note || ""}`);
      } else {
        throw new Error(data.error || "No valid response from try-on API");
      }
    } catch (err: any) {
      console.error("Try-on generation error:", err);
      setError(err.message || "Failed to generate try-on. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!compositeImage) return;

    const link = document.createElement("a");
    link.href = compositeImage;
    link.download = `tryon-${product.title
      .replace(/\s+/g, "-")
      .toLowerCase()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddToCart = () => {
    onAddToCart(product);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <div className='bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b border-gray-200'>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>Virtual Try-On</h2>
            <p className='text-sm text-gray-600'>{product.title}</p>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-100 rounded-full transition-colors'
            aria-label='Close modal'
          >
            <svg
              className='w-6 h-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className='flex border-b border-gray-200 bg-gray-50'>
          <button
            onClick={() => setActiveTab("tryon")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "tryon"
                ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Try-On Result
          </button>
          <button
            onClick={() => setActiveTab("original")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "original"
                ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Your Photo
          </button>
          <button
            onClick={() => setActiveTab("product")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "product"
                ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Product
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto p-6'>
          {isGenerating && (
            <div className='flex flex-col items-center justify-center h-full space-y-4'>
              <div className='animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600'></div>
              <p className='text-gray-600'>Generating your try-on...</p>
              <p className='text-sm text-gray-500'>
                This may take 10-15 seconds
              </p>
            </div>
          )}

          {error && !isGenerating && (
            <div className='flex flex-col items-center justify-center h-full space-y-4'>
              <div className='text-red-600'>
                <svg
                  className='w-16 h-16 mx-auto'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
              </div>
              <p className='text-gray-900 font-medium'>
                Failed to generate try-on
              </p>
              <p className='text-sm text-gray-600 text-center max-w-md'>
                {error}
              </p>
              <button
                onClick={generateTryOn}
                className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
              >
                Try Again
              </button>
            </div>
          )}

          {!isGenerating && !error && (
            <div className='flex items-center justify-center'>
              {activeTab === "tryon" && compositeImage && (
                <img
                  src={compositeImage}
                  alt='Virtual try-on result'
                  className='max-w-full max-h-[60vh] rounded-lg shadow-lg'
                />
              )}
              {activeTab === "original" && (
                <img
                  src={selfieImageUrl}
                  alt='Your original photo'
                  className='max-w-full max-h-[60vh] rounded-lg shadow-lg'
                />
              )}
              {activeTab === "product" && product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className='max-w-full max-h-[60vh] rounded-lg shadow-lg'
                />
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isGenerating && !error && compositeImage && (
          <div className='flex items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50'>
            <button
              onClick={handleDownload}
              className='px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
            >
              Download Image
            </button>
            <div className='flex gap-3'>
              <button
                onClick={onClose}
                className='px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
              >
                Close
              </button>
              <button
                onClick={handleAddToCart}
                className='px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium'
              >
                Add to Cart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
