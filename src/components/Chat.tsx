import { useState, useRef, useEffect } from "react";
import type { UIProduct } from "../types/product";
import { searchProducts } from "../lib/productUtils";
import SelfieUpload from "./SelfieUpload";
import ProductGrid from "./ProductGrid";
import TryOnModal from "./TryOnModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  products?: UIProduct[];
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasContext, setHasContext] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<UIProduct | null>(
    null
  );
  const [isTryOnModalOpen, setIsTryOnModalOpen] = useState(false);
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

  function detectProductQuery(text: string): UIProduct[] | null {
    const lowerText = text.toLowerCase();
    const productKeywords = [
      "shirt",
      "shirts",
      "clothing",
      "wear",
      "buy",
      "shop",
      "show",
      "find",
    ];

    const hasProductKeyword = productKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    if (hasProductKeyword) {
      // If user is asking about products, just return all products for now
      // (since we only have shirts anyway)
      return searchProducts("");
    }

    return null;
  }

  async function processStreamedResponse(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    userQuery: string
  ) {
    let assistantMessage = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      assistantMessage += text;
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: assistantMessage },
      ]);
    }

    // Check if the user query was about products
    const products = detectProductQuery(userQuery);
    if (products && products.length > 0) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: assistantMessage, products },
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

  function handleTryOn(product: UIProduct) {
    if (!selfieImage) {
      alert(
        "Please upload your photo first to use the virtual try-on feature!"
      );
      return;
    }
    setSelectedProduct(product);
    setIsTryOnModalOpen(true);
  }

  function handleAddToCart(product: UIProduct) {
    // Note: Cart will be handled by Shopify MCP
    alert(`${product.title} will be added to cart via Shopify MCP`);
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
              onTryOn={handleTryOn}
              onAddToCart={handleAddToCart}
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
    <div className='flex flex-col h-[800px] border border-gray-200 rounded-lg bg-white shadow-lg'>
      {/* Header */}
      <div className='flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50'>
        <span className='text-sm text-gray-500'>
          {hasContext ? "Conversation context: On" : "New conversation"}
        </span>
        <button
          onClick={startNewConversation}
          className='px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded'
          disabled={isLoading}
        >
          New Conversation
        </button>
      </div>

      {/* Selfie Upload */}
      <div className='p-4 border-b border-gray-200'>
        <SelfieUpload
          onImageSelected={setSelfieImage}
          currentImage={selfieImage}
        />
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
          className='px-4 py-2 bg-blue-600 text-white rounded cursor-pointer text-base disabled:bg-blue-400 disabled:cursor-not-allowed'
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
          }}
          product={selectedProduct}
          selfieImage={selfieImage}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}
