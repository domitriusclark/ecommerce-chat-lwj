import { useState } from 'react';
import Sidebar from './Sidebar';
import Chat from './Chat';

export default function AppContainer() {
  const [selfieImage, setSelfieImage] = useState<string>('');

  return (
    <div className="flex h-screen">
      <Sidebar onImageSelected={setSelfieImage} currentImage={selfieImage} />
      <Chat selfieImage={selfieImage} />
    </div>
  );
}

