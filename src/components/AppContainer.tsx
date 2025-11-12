import { useState } from 'react';
import Sidebar from './Sidebar';
import Chat from './Chat';

interface GeneratedImage {
  id: string;
  image: string;
  productTitle: string;
  timestamp: number;
}

export default function AppContainer() {
  const [selfieImage, setSelfieImage] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  const addGeneratedImage = (image: string, productTitle: string) => {
    const newImage: GeneratedImage = {
      id: Date.now().toString(),
      image,
      productTitle,
      timestamp: Date.now(),
    };
    setGeneratedImages(prev => [newImage, ...prev]); // Add to beginning for newest first
  };

  return (
    <div className="flex h-screen">
      <Sidebar 
        onImageSelected={setSelfieImage} 
        currentImage={selfieImage}
        generatedImages={generatedImages}
      />
      <Chat 
        selfieImage={selfieImage}
        onImageGenerated={addGeneratedImage}
      />
    </div>
  );
}

