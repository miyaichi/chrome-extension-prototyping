// src/popup/Popup.tsx
import React, { useEffect, useState } from 'react';
import { Settings } from '../types';

const Popup: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    // Load settings from chrome.storage
    chrome.storage.sync.get(['settings'], (result) => {
      setSettings(result.settings);
    });
  }, []);

  return (
    <div className="popup">
      <h1>Chrome Extension</h1>
      {settings && (
        <div>
          {/* Settings display/edit UI */}
        </div>
      )}
    </div>
  );
};

export default Popup;