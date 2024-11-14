/**
 * Background script for Chrome extension that manages extension state and messaging.
 * This module is responsible for:
 * - Managing the extension's lifecycle
 * - Handling tab activation and deactivation
 * - Coordinating communication between components
 * - Managing side panel functionality
 * - Processing global extension messages
 * 
 * @module background
 * @requires chrome
 */

/** 
 * Tracks the currently active tab where the extension is running
 * Used to manage extension state and messaging across tabs
 * @type {number | null}
 */
let activeTabId: number | null = null;

/**
 * Debug logging utility for background script operations
 * Prefixes all log messages with [Background] for easier debugging
 * 
 * @param message - Primary message to log
 * @param args - Additional arguments to include in log
 */
function backgroundDebugLog(message: string, ...args: any[]): void {
  console.log(`[Background] ${message}`, ...args);
}

/**
 * Error logging utility for background script operations
 * Prefixes all error messages with [Background] for easier debugging
 * 
 * @param message - Primary error message to log
 * @param args - Additional arguments to include in error log
 */
function backgroundErrorLog(message: string, ...args: any[]): void {
  console.error(`[Background] ${message}`, ...args);
}

/**
 * Configures and initializes the extension's side panel
 * Sets up the panel's HTML path and enables it for use
 * Handles any errors during setup
 * 
 * @throws {Error} If side panel setup fails
 */
chrome.sidePanel
  .setOptions({
    enabled: true,
    path: 'sidepanel.html'
  })
  .catch((error) => backgroundErrorLog('Error setting up side panel:', error));

/**
 * Extension installation handler
 * Sets up initial configuration and UI elements when the extension is installed
 * 
 * @listens chrome.runtime.onInstalled
 */
chrome.runtime.onInstalled.addListener(() => {
  backgroundDebugLog('Extension installed');
  chrome.action.setTitle({ title: 'Open DOM Inspector' });
});

/**
 * Extension toolbar icon click handler
 * Manages the activation and deactivation of the extension in different tabs
 * Handles the following tasks:
 * - Deactivates extension in previously active tab
 * - Activates extension in newly selected tab
 * - Opens the side panel for inspection
 * 
 * @param tab - Chrome tab object where the extension icon was clicked
 * @listens chrome.action.onClicked
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
 * Tab removal event handler
 * Cleans up extension state when tabs are closed
 * Resets activeTabId if the closed tab was active
 * 
 * @param tabId - ID of the tab that was closed
 * @listens chrome.tabs.onRemoved
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  backgroundDebugLog('Tab removed:', tabId);
  if (tabId === activeTabId) {
    activeTabId = null;
  }
});

/**
 * Content script connection handler
 * Establishes and manages long-lived connections with content scripts
 * Sets up message handling and cleanup for each connection
 * 
 * @param port - Chrome runtime port object representing the connection
 * @listens chrome.runtime.onConnect
 */
chrome.runtime.onConnect.addListener((port) => {
  backgroundDebugLog('New connection from:', port.name);

  /**
   * Port message handler
   * Processes messages received through the connection
   * 
   * @param message - Message received from the port
   */
  port.onMessage.addListener((message) => {
    backgroundDebugLog('Received message from port:', message);
  });

  /**
   * Port disconnection handler
   * Cleans up resources and logs errors when connection is lost
   */
  port.onDisconnect.addListener(() => {
    backgroundDebugLog('Port disconnected:', port.name);
    if (chrome.runtime.lastError) {
      backgroundErrorLog('Port error:', chrome.runtime.lastError);
    }
  });
});

/**
 * Global extension message handler
 * Processes messages from all extension components
 * Provides centralized message routing and response handling
 * 
 * @param message - Message object received from extension component
 * @param sender - Sender information including tab and frame details
 * @param sendResponse - Callback function to send response to sender
 * @returns {boolean} False for synchronous response, true if response will be sent asynchronously
 * @listens chrome.runtime.onMessage
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

/**
 * Type declarations and interfaces
 * @example
 * ```typescript
 * interface ExtensionMessage {
 *   type: string;
 *   payload?: any;
 * }
 * 
 * type MessageResponse = {
 *   received: boolean;
 *   error?: string;
 * }
 * ```
 */