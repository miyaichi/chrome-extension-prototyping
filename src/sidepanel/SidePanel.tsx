// src/sidepanel/SidePanel.tsx
import React, { useEffect, useState } from 'react';
import { Settings } from '../types';

const SidePanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    // Load settings from chrome.storage
    chrome.storage.sync.get(['settings'], (result) => {
      setSettings(result.settings);
    });
  }, []);

  return (
    <div className="h-full w-full bg-white dark:bg-gray-800 p-4">
      <h1 className="text-xl font-bold mb-4">Chrome Extension</h1>
      {settings && (
        <div className="space-y-4">
          {/* Settings display/edit UI */}
        </div>
      )}
    </div>
  );
};

export default SidePanel;