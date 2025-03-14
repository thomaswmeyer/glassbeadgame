'use client';

import React, { useState, useEffect } from 'react';
import GameInterface from './components/GameInterface';

export default function ClientApp() {
  const [isClient, setIsClient] = useState(false);

  // This effect will only run on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only render the GameInterface on the client
  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-4">The Glass Bead Game</h1>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return <GameInterface />;
} 