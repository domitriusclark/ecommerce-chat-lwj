import { useState, useRef } from "react";
import {
  fileToBase64,
  validateImageSize,
  validateImageType,
} from "../lib/imageUtils";

interface SidebarProps {
  onImageSelected: (base64: string) => void;
  currentImage?: string;
}

export default function Sidebar({
  onImageSelected,
  currentImage,
}: SidebarProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!validateImageType(file)) {
      setError("Please upload a valid image file (JPEG, PNG, or WebP)");
      return;
    }

    // Validate file size
    if (!validateImageSize(file)) {
      setError("Image size must be less than 5MB");
      return;
    }

    try {
      setIsUploading(true);
      const base64 = await fileToBase64(file);
      onImageSelected(base64);
    } catch (err) {
      setError("Failed to process image. Please try again.");
      console.error("Error processing image:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onImageSelected("");
    setError(null);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className='h-screen w-64 bg-gray-900 text-white flex flex-col border-r border-gray-700'>
      {/* Header */}
      <div className='p-4 border-b border-gray-700'>
        <h2 className='text-lg font-semibold'>Virtual Try-On</h2>
      </div>

      {/* Upload Section */}
      <div className='p-4 border-b border-gray-700'>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/jpeg,image/jpg,image/png,image/webp'
          onChange={handleFileChange}
          className='hidden'
          disabled={isUploading}
        />

        <button
          onClick={handleButtonClick}
          disabled={isUploading}
          className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600'
        >
          <svg
            className='w-5 h-5'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
            />
          </svg>
          <span className='text-sm font-medium'>
            {isUploading
              ? "Uploading..."
              : currentImage
              ? "Change Photo"
              : "Upload Photo"}
          </span>
        </button>

        {error && (
          <div className='mt-2 px-3 py-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-200'>
            {error}
          </div>
        )}

        {currentImage && (
          <button
            onClick={handleReset}
            className='w-full mt-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg transition-colors'
            disabled={isUploading}
          >
            Remove Photo
          </button>
        )}
      </div>

      {/* Info Section */}
      <div className='flex-1 p-4 overflow-y-auto'>
        <div className='text-sm text-gray-400 space-y-3'>
          <div>
            <h3 className='font-semibold text-gray-200 mb-2'>How it works:</h3>
            <ol className='list-decimal list-inside space-y-2 text-xs'>
              <li>Upload your photo using the button above</li>
              <li>Ask the AI to show you shirts</li>
              <li>Click "Try On" to see how they look on you</li>
            </ol>
          </div>

          <div className='pt-4 border-t border-gray-700'>
            <h3 className='font-semibold text-gray-200 mb-2'>Try asking:</h3>
            <ul className='space-y-1 text-xs'>
              <li>• "Show me blue shirts"</li>
              <li>• "Find casual shirts"</li>
              <li>• "What shirts do you have?"</li>
            </ul>
          </div>

          {/* Display uploaded photo */}
          {currentImage && (
            <div className='pt-4 border-t border-gray-700'>
              <h3 className='font-semibold text-gray-200 mb-2'>Your photo:</h3>
              <div className='rounded-lg overflow-hidden border border-gray-600'>
                <img
                  src={currentImage}
                  alt='Uploaded selfie'
                  className='w-full h-auto object-contain'
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
