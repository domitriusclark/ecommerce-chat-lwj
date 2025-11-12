import { useState } from "react";
import type { UIProduct, ProductVariant } from "../types/product";

interface VariantSelectorProps {
  product: UIProduct;
  onSelect: (variant: ProductVariant, quantity: number) => void;
  onClose: () => void;
}

export default function VariantSelector({
  product,
  onSelect,
  onClose,
}: VariantSelectorProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants?.[0] || null
  );
  const [quantity, setQuantity] = useState(1);

  const handleSelect = () => {
    if (selectedVariant) {
      onSelect(selectedVariant, quantity);
      onClose();
    }
  };

  const formatPrice = (price: string) => {
    const amount = parseFloat(price);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <div className='bg-white rounded-lg shadow-xl max-w-md w-full p-6'>
        {/* Header */}
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-xl font-bold text-gray-900'>Select Options</h2>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-100 rounded-full transition-colors'
            aria-label='Close'
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
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {/* Product Info */}
        <div className='mb-6'>
          <div className='flex gap-4'>
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.title}
                className='w-20 h-20 object-cover rounded-lg'
              />
            )}
            <div className='flex-1'>
              <h3 className='font-semibold text-gray-900'>{product.title}</h3>
              {product.price && (
                <p className='text-lg font-bold text-gray-900 mt-1'>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: product.price.currencyCode,
                  }).format(product.price.amount)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Variant Selection */}
        {product.variants && product.variants.length > 0 && (
          <div className='mb-6'>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Size
            </label>
            <div className='grid grid-cols-3 gap-2'>
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  disabled={!variant.availableForSale}
                  className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    selectedVariant?.id === variant.id
                      ? "border-black bg-black text-white"
                      : variant.availableForSale
                      ? "border-gray-300 bg-white text-gray-900 hover:border-gray-400"
                      : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {variant.title}
                  {!variant.availableForSale && (
                    <span className='block text-xs'>Out of Stock</span>
                  )}
                </button>
              ))}
            </div>
            {selectedVariant && (
              <p className='mt-2 text-sm text-gray-600'>
                Price: {formatPrice(selectedVariant.price)}
              </p>
            )}
          </div>
        )}

        {/* Quantity Selection */}
        <div className='mb-6'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Quantity
          </label>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className='w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
              disabled={quantity <= 1}
            >
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M20 12H4'
                />
              </svg>
            </button>
            <span className='w-12 text-center font-semibold text-lg'>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className='w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
            >
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 4v16m8-8H4'
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className='flex gap-3'>
          <button
            onClick={onClose}
            className='flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedVariant || !selectedVariant.availableForSale}
            className='flex-1 px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed'
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

