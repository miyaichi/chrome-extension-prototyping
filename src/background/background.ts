// src/background/background.ts

// Set up the side panel to be displayed in the UI
chrome.sidePanel
  .setOptions({
    enabled: true,
    path: 'sidepanel.html'
  })
  .catch((error) => console.error(error));

// When the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Default side panel settings
  chrome.action.setTitle({ title: 'Open DOM Inspector' });
});

// When the toolbar icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  
  // Open the side panel
  chrome.sidePanel
    .open({ tabId: tab.id })
    .catch((error) => console.error(error));
});