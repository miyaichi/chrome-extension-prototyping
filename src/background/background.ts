// src/background/background.ts
import { Settings } from '../types';

chrome.runtime.onInstalled.addListener(() => {
  // Initialize default settings
  const defaultSettings: Settings = {
    enabled: true,
    // Add other default settings
  };

  chrome.storage.sync.set({ settings: defaultSettings });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages from content script or popup
});