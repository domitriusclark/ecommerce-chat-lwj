import { useState } from 'react';
import Sidebar from './Sidebar';
import Chat from './Chat';
import type { CartItem, UIProduct, ProductVariant } from '../types/product';

interface GeneratedImage {
  id: string;
  image: string;
  productTitle: string;
  timestamp: number;
}

export default function AppContainer() {
  const [selfieImage, setSelfieImage] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addGeneratedImage = (image: string, productTitle: string) => {
    const newImage: GeneratedImage = {
      id: Date.now().toString(),
      image,
      productTitle,
      timestamp: Date.now(),
    };
    setGeneratedImages(prev => [newImage, ...prev]); // Add to beginning for newest first
  };

  // Cart operations
  const addToCart = (product: UIProduct, variant: ProductVariant, quantity: number) => {
    // Check if item with same product and variant already exists
    const existingItemIndex = cartItems.findIndex(
      item => item.product.id === product.id && item.variant.id === variant.id
    );

    if (existingItemIndex >= 0) {
      // Update quantity of existing item
      const updatedItems = [...cartItems];
      updatedItems[existingItemIndex].quantity += quantity;
      setCartItems(updatedItems);
    } else {
      // Add new item
      const newItem: CartItem = {
        id: `${product.id}-${variant.id}-${Date.now()}`,
        product,
        variant,
        quantity,
      };
      setCartItems(prev => [...prev, newItem]);
    }
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setCartItems(prev =>
      prev.map(item =>
        item.id === cartItemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const clearCart = () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      setCartItems([]);
    }
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex h-screen">
      <Sidebar 
        onImageSelected={setSelfieImage} 
        currentImage={selfieImage}
        generatedImages={generatedImages}
        cartItems={cartItems}
        cartItemCount={totalItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onClearCart={clearCart}
      />
      <Chat 
        selfieImage={selfieImage}
        onImageGenerated={addGeneratedImage}
        onAddToCart={addToCart}
      />
    </div>
  );
}

