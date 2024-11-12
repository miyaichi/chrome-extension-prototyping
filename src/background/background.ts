// src/background/background.ts

let activeTabId: number | null = null;

// Set up the side panel to be displayed in the UI
chrome.sidePanel
  .setOptions({
    enabled: true,
    path: 'sidepanel.html'
  })
  .catch((error) => console.error('[Background] Error setting up side panel:', error));

// When the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed');
  chrome.action.setTitle({ title: 'Open DOM Inspector' });
});

// When the toolbar icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) {
    console.log('[Background] No tab ID available');
    return;
  }

  console.log('[Background] Action clicked for tab:', tab.id);
  
  // Deactivate previous tab if exists
  if (activeTabId && activeTabId !== tab.id) {
    console.log('[Background] Deactivating previous tab:', activeTabId);
    chrome.tabs.sendMessage(activeTabId, { type: 'DEACTIVATE_EXTENSION' })
      .catch(error => console.log('[Background] Error deactivating previous tab:', error));
  }

  // Activate new tab
  activeTabId = tab.id;
  chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_EXTENSION' })
    .catch(error => console.log('[Background] Error activating new tab:', error));
  
  // Open the side panel
  chrome.sidePanel.open({ tabId: tab.id })
    .catch(error => console.error('[Background] Error opening side panel:', error));
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log('[Background] Tab removed:', tabId);
  if (tabId === activeTabId) {
    activeTabId = null;
  }
});

// Handle connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  console.log('[Background] New connection from:', port.name);

  port.onMessage.addListener((message) => {
    console.log('[Background] Received message from port:', message);
  });

  port.onDisconnect.addListener(() => {
    console.log('[Background] Port disconnected:', port.name);
    if (chrome.runtime.lastError) {
      console.error('[Background] Port error:', chrome.runtime.lastError);
    }
  });
});

// Global message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message, 'from:', sender);
  sendResponse({ received: true });
  return false;
});