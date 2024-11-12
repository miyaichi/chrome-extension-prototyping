// src/background/background.ts

let activeTabId: number | null = null;

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
  
  // Deactivate previous tab if exists
  if (activeTabId && activeTabId !== tab.id) {
    chrome.tabs.sendMessage(activeTabId, { type: 'DEACTIVATE_EXTENSION' })
      .catch(error => console.log('Error deactivating previous tab:', error));
  }

  // Activate new tab
  activeTabId = tab.id;
  chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_EXTENSION' })
    .catch(error => console.log('Error activating new tab:', error));
  
  // Open the side panel
  chrome.sidePanel
    .open({ tabId: tab.id })
    .catch((error) => console.error(error));
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    activeTabId = null;
  }
});

// Handle connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  console.log('[Background] New connection from:', port.name);

  port.onDisconnect.addListener(() => {
    console.log('[Background] Port disconnected:', port.name);
  });
});