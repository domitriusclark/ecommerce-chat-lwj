import { useState } from 'react';
import Sidebar from './Sidebar';
import Chat from './Chat';

export default function AppContainer() {
  const [selfieImageId, setSelfieImageId] = useState<string>('');
  const [selfieImageUrl, setSelfieImageUrl] = useState<string>('');

  const handleImageSelected = (imageId: string, imageUrl: string) => {
    setSelfieImageId(imageId);
    setSelfieImageUrl(imageUrl);
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        onImageSelected={handleImageSelected}
        currentImageUrl={selfieImageUrl}
      />
      <Chat
        selfieImageId={selfieImageId}
        selfieImageUrl={selfieImageUrl}
      />
    </div>
  );
}

