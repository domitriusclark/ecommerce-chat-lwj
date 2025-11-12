import { useState } from "react";
import type { CartItem } from "../types/product";

interface ShoppingCartProps {
  cartItems: CartItem[];
  onUpdateQuantity: (cartItemId: string, newQuantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
}

export default function ShoppingCart({
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: ShoppingCartProps) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const formatPrice = (price: string) => {
    const amount = parseFloat(price);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const calculateItemTotal = (item: CartItem) => {
    const price = parseFloat(item.variant.price);
    return price * item.quantity;
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      return total + calculateItemTotal(item);
    }, 0);
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      // Prepare line items for Shopify checkout
      const lineItems = cartItems.map(item => ({
        variantId: item.variant.id,
        quantity: item.quantity,
      }));

      // Call checkout API
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lineItems }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout');
      }

      const data = await response.json();

      // Redirect to Shopify checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError(
        error instanceof Error ? error.message : 'Failed to proceed to checkout'
      );
      setIsCheckingOut(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center h-full p-6 text-center'>
        <svg
          className='w-20 h-20 text-gray-600 mb-4'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={1.5}
            d='M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'
          />
        </svg>
        <h3 className='text-lg font-semibold text-gray-200 mb-2'>
          Your cart is empty
        </h3>
        <p className='text-sm text-gray-400'>
          Add items from the chat to get started
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Cart Items */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {cartItems.map((item) => (
          <div
            key={item.id}
            className='bg-gray-800 rounded-lg p-3 border border-gray-700'
          >
            <div className='flex gap-3'>
              {/* Product Image */}
              {item.product.imageUrl && (
                <img
                  src={item.product.imageUrl}
                  alt={item.product.title}
                  className='w-20 h-20 object-cover rounded-lg flex-shrink-0'
                />
              )}

              {/* Product Details */}
              <div className='flex-1 min-w-0'>
                <h4 className='text-sm font-semibold text-gray-200 truncate'>
                  {item.product.title}
                </h4>
                <p className='text-xs text-gray-400 mt-1'>
                  Size: {item.variant.title}
                </p>
                <p className='text-sm font-bold text-gray-200 mt-1'>
                  {formatPrice(item.variant.price)}
                </p>

                {/* Quantity Controls */}
                <div className='flex items-center gap-2 mt-2'>
                  <button
                    onClick={() =>
                      onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))
                    }
                    className='w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-gray-200 transition-colors'
                    disabled={item.quantity <= 1}
                  >
                    <svg
                      className='w-3 h-3'
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
                  <span className='text-sm font-medium text-gray-200 w-8 text-center'>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className='w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-gray-200 transition-colors'
                  >
                    <svg
                      className='w-3 h-3'
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

              {/* Remove Button */}
              <button
                onClick={() => onRemoveItem(item.id)}
                className='flex-shrink-0 p-2 hover:bg-gray-700 rounded-lg transition-colors text-red-400 hover:text-red-300'
                aria-label='Remove item'
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
                    d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                  />
                </svg>
              </button>
            </div>

            {/* Item Total */}
            <div className='mt-2 pt-2 border-t border-gray-700'>
              <div className='flex justify-between items-center'>
                <span className='text-xs text-gray-400'>Item Total:</span>
                <span className='text-sm font-bold text-gray-200'>
                  {formatPrice(calculateItemTotal(item).toString())}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      <div className='border-t border-gray-700 p-4 bg-gray-800'>
        <div className='space-y-2 mb-4'>
          <div className='flex justify-between items-center text-sm'>
            <span className='text-gray-400'>Items ({totalItems})</span>
            <span className='text-gray-200 font-medium'>
              {formatPrice(calculateSubtotal().toString())}
            </span>
          </div>
          <div className='flex justify-between items-center pt-2 border-t border-gray-700'>
            <span className='text-gray-200 font-semibold'>Subtotal</span>
            <span className='text-gray-200 font-bold text-lg'>
              {formatPrice(calculateSubtotal().toString())}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {checkoutError && (
          <div className='mb-3 p-3 bg-red-900/50 border border-red-700 rounded-lg text-xs text-red-200'>
            {checkoutError}
          </div>
        )}

        {/* Checkout Button */}
        <button
          onClick={handleCheckout}
          disabled={isCheckingOut}
          className='w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors mb-2 disabled:bg-gray-600 disabled:cursor-not-allowed'
        >
          {isCheckingOut ? (
            <span className='flex items-center justify-center gap-2'>
              <svg
                className='animate-spin h-4 w-4'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                />
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                />
              </svg>
              Processing...
            </span>
          ) : (
            'Proceed to Checkout'
          )}
        </button>

        {/* Clear Cart Button */}
        <button
          onClick={onClearCart}
          disabled={isCheckingOut}
          className='w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed'
        >
          Clear Cart
        </button>
      </div>
    </div>
  );
}

