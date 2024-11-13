/**
 * Background script for Chrome extension that manages extension state and messaging
 * @module background
 */

/** ID of the currently active tab where the extension is running */
let activeTabId: number | null = null;

/**
 * Logs debug messages with background script prefix
 * @param message - Main message to log
 * @param args - Additional arguments to log
 */
function backgroundDebugLog(message: string, ...args: any[]): void {
  console.log(`[Background] ${message}`, ...args);
}

/**
 * Logs error messages with background script prefix
 * @param message - Main error message to log
 * @param args - Additional arguments to log
 */
function backgroundErrorLog(message: string, ...args: any[]): void {
  console.error(`[Background] ${message}`, ...args);
}

/**
 * Configures and initializes the extension's side panel
 * Sets up the HTML path and enables the panel
 */
chrome.sidePanel
  .setOptions({
    enabled: true,
    path: 'sidepanel.html'
  })
  .catch((error) => backgroundErrorLog('Error setting up side panel:', error));

/**
 * Handles extension installation
 * Sets up initial configuration and UI elements
 */
chrome.runtime.onInstalled.addListener(() => {
  backgroundDebugLog('Extension installed');
  chrome.action.setTitle({ title: 'Open DOM Inspector' });
});

/**
 * Handles clicks on the extension's toolbar icon
 * Manages activation/deactivation of the extension in different tabs
 * @param tab - The tab where the extension icon was clicked
 */
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) {
    backgroundDebugLog('No tab ID available');
    return;
  }

  backgroundDebugLog('Action clicked for tab:', tab.id);
  
  // Deactivate previous tab if exists
  if (activeTabId && activeTabId !== tab.id) {
    backgroundDebugLog('Deactivating previous tab:', activeTabId);
    chrome.tabs.sendMessage(activeTabId, { type: 'DEACTIVATE_EXTENSION' })
      .catch(error => backgroundErrorLog('deactivating previous tab:', error));
  }

  // Activate new tab
  activeTabId = tab.id;
  chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_EXTENSION' })
    .catch(error => backgroundErrorLog('activating new tab:', error));
  
  // Open the side panel
  chrome.sidePanel.open({ tabId: tab.id })
    .catch(error => backgroundErrorLog('Error opening side panel:', error));
});

/**
 * Handles tab removal events
 * Cleans up extension state when tabs are closed
 * @param tabId - ID of the removed tab
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  backgroundDebugLog('Tab removed:', tabId);
  if (tabId === activeTabId) {
    activeTabId = null;
  }
});

/**
 * Handles connections from content scripts
 * Sets up message handling and disconnect cleanup for each connection
 * @param port - The connection port from the content script
 */
chrome.runtime.onConnect.addListener((port) => {
  backgroundDebugLog('New connection from:', port.name);

  // Handle messages received on this port
  port.onMessage.addListener((message) => {
    backgroundDebugLog('Received message from port:', message);
  });

  // Handle port disconnection
  port.onDisconnect.addListener(() => {
    backgroundDebugLog('Port disconnected:', port.name);
    if (chrome.runtime.lastError) {
      backgroundErrorLog('Port error:', chrome.runtime.lastError);
    }
  });
});

/**
 * Global message handler for the extension
 * Processes messages from content scripts and other extension components
 * @param message - The message received
 * @param sender - Information about the sender of the message
 * @param sendResponse - Callback function to send a response
 * @returns Boolean indicating if response will be sent asynchronously
 */
chrome.runtime.onMessage.addListener((
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean => {
  backgroundDebugLog('Received message:', message, 'from:', sender);
  sendResponse({ received: true });
  return false; // Synchronous response
});