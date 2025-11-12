import { useState, useRef, useEffect } from "react";
import type { UIProduct, ProductVariant } from "../types/product";
import {
  mapShopifyMCPToUIProduct,
  type ShopifyMCPProduct,
} from "../lib/productUtils";
import ProductGrid from "./ProductGrid";
import TryOnModal from "./TryOnModal";
import VariantSelector from "./VariantSelector";

interface Message {
  role: "user" | "assistant";
  content: string;
  products?: UIProduct[];
  userQuery?: string; // Store the original user query for context
}

interface ChatProps {
  selfieImage: string;
  onImageGenerated: (image: string, productTitle: string) => void;
  onAddToCart: (
    product: UIProduct,
    variant: ProductVariant,
    quantity: number
  ) => void;
}

export default function Chat({
  selfieImage,
  onImageGenerated,
  onAddToCart,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasContext, setHasContext] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<UIProduct | null>(
    null
  );
  const [isTryOnModalOpen, setIsTryOnModalOpen] = useState(false);
  const [isVariantSelectorOpen, setIsVariantSelectorOpen] = useState(false);
  const [productForCart, setProductForCart] = useState<UIProduct | null>(null);
  const [currentUserContext, setCurrentUserContext] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
  }

  async function startNewConversation() {
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newConversation: true }),
      });
      setMessages([]);
      setHasContext(false);
    } catch (error) {
      console.error("Error starting new conversation:", error);
    }
  }

  async function processStreamedResponse(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    userQuery: string
  ) {
    let assistantMessage = "";
    let shopifyProducts: UIProduct[] | undefined;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      assistantMessage += text;

      // Check for Shopify product markers
      const productMatch = assistantMessage.match(
        /\[SHOPIFY_PRODUCTS\](.*?)\[\/SHOPIFY_PRODUCTS\]/s
      );
      if (productMatch) {
        try {
          const mcpProducts: ShopifyMCPProduct[] = JSON.parse(productMatch[1]);
          console.log("Raw MCP Products:", mcpProducts);
          shopifyProducts = mcpProducts.map(mapShopifyMCPToUIProduct);
          console.log(
            `Parsed ${shopifyProducts.length} Shopify products from stream`
          );
          console.log("Mapped UIProducts:", shopifyProducts);

          // Remove the marker from the displayed message
          assistantMessage = assistantMessage.replace(
            /\[SHOPIFY_PRODUCTS\].*?\[\/SHOPIFY_PRODUCTS\]\n?/s,
            ""
          );
        } catch (e) {
          console.error("Failed to parse Shopify products from stream:", e);
        }
      }

      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: assistantMessage,
          products: shopifyProducts,
          userQuery: shopifyProducts ? userQuery : undefined,
        },
      ]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user" as const, content: input.trim() };
    const userQuery = input.trim();
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      await processStreamedResponse(reader, userQuery);
      setHasContext(true);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was an error processing your request.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleTryOn(product: UIProduct, userContext?: string) {
    if (!selfieImage) {
      alert(
        "Please upload your photo first to use the virtual try-on feature!"
      );
      return;
    }
    setSelectedProduct(product);
    setCurrentUserContext(userContext || "");
    setIsTryOnModalOpen(true);
  }

  function handleAddToCartClick(product: UIProduct) {
    setProductForCart(product);
    setIsVariantSelectorOpen(true);
  }

  function handleVariantSelected(variant: ProductVariant, quantity: number) {
    if (productForCart) {
      onAddToCart(productForCart, variant, quantity);
      setProductForCart(null);
    }
  }

  function renderMessage(message: Message, index: number) {
    return (
      <div key={index} className='mb-6'>
        <div
          className={`mb-4 p-3 rounded-lg ${
            message.role === "user"
              ? "ml-auto bg-blue-600 text-white max-w-[80%]"
              : "mr-auto bg-gray-100 text-gray-800 max-w-[95%]"
          }`}
        >
          <strong>{message.role === "user" ? "You: " : "AI: "}</strong>
          <span className='whitespace-pre-wrap'>{message.content}</span>
        </div>
        {message.products && message.products.length > 0 && (
          <div className='mt-4'>
            <ProductGrid
              products={message.products}
              onTryOn={(product) => handleTryOn(product, message.userQuery)}
              onAddToCart={handleAddToCartClick}
            />
          </div>
        )}
      </div>
    );
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  return (
    <div className='flex flex-col h-screen flex-1 bg-white'>
      {/* Header */}
      <div className='flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50'>
        <div className='flex items-center gap-4'>
          <span className='text-sm text-gray-500'>
            {hasContext ? "Conversation context: On" : "New conversation"}
          </span>
          {/* Display uploaded image indicator */}
          {selfieImage && (
            <div className='flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full'>
              <div className='w-6 h-6 rounded-full overflow-hidden border border-green-300'>
                <img
                  src={selfieImage}
                  alt='Uploaded'
                  className='w-full h-full object-cover'
                />
              </div>
              <span className='text-xs text-green-700 font-medium'>
                Photo loaded
              </span>
            </div>
          )}
        </div>
        <button
          onClick={startNewConversation}
          className='px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded'
          disabled={isLoading}
        >
          New Conversation
        </button>
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto p-4'>
        {messages.length === 0 && (
          <div className='flex flex-col items-center justify-center h-full text-gray-500 space-y-4'>
            <svg
              className='w-16 h-16'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1.5}
                d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
              />
            </svg>
            <div className='text-center'>
              <p className='font-medium text-lg mb-2'>
                Welcome to Virtual Try-On Shopping!
              </p>
              <p className='text-sm'>
                Upload your photo above, then ask me to show you shirts
              </p>
              <p className='text-xs mt-4 text-gray-400'>
                Try: "Show me blue shirts" or "Find me a casual shirt"
              </p>
            </div>
          </div>
        )}
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className='flex p-4 border-t border-gray-200 gap-2'
      >
        <input
          ref={inputRef}
          type='text'
          value={input}
          onChange={handleInputChange}
          placeholder='Ask me about shirts...'
          className='flex-1 p-2 border border-gray-200 rounded text-base disabled:bg-gray-50 disabled:cursor-not-allowed'
          disabled={isLoading}
        />
        <button
          type='submit'
          disabled={isLoading}
          className='px-4 py-2 bg-black text-white rounded cursor-pointer text-base disabled:bg-gray-400 disabled:cursor-not-allowed'
        >
          {isLoading ? "Sending..." : "Send"}
        </button>
      </form>

      {/* Try-On Modal */}
      {selectedProduct && (
        <TryOnModal
          isOpen={isTryOnModalOpen}
          onClose={() => {
            setIsTryOnModalOpen(false);
            setSelectedProduct(null);
            setCurrentUserContext("");
          }}
          product={selectedProduct}
          selfieImage={selfieImage}
          userContext={currentUserContext}
          onAddToCart={onAddToCart}
          onImageGenerated={onImageGenerated}
        />
      )}

      {/* Variant Selector */}
      {isVariantSelectorOpen && productForCart && (
        <VariantSelector
          product={productForCart}
          onSelect={handleVariantSelected}
          onClose={() => {
            setIsVariantSelectorOpen(false);
            setProductForCart(null);
          }}
        />
      )}
    </div>
  );
}
