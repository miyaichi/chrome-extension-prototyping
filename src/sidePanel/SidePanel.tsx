/**
 * Side Panel component for DOM Inspector Chrome extension.
 * Provides a user interface for inspecting and navigating DOM elements in the active tab.
 * 
 * @module SidePanel
 * @requires react
 * @requires lucide-react
 * @requires react-tooltip
 */

import { ArrowUp, Loader2, RefreshCw, Undo } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { DOMElement } from '../types';
import DOMTreeView from './DOMTreeView';

// Utility functions
/** Debug logging with [Side Panel] prefix */
const sidePanelDebugLog = (message: string, ...args: any[]): void => 
  console.log(`[Side Panel] ${message}`, ...args);

/** Error logging with [Side Panel] prefix */
const sidePanelErrorLog = (message: string, ...args: any[]): void => 
  console.error(`[Side Panel] ${message}`, ...args);

/**
 * Checks if a tab is inspectable by verifying:
 * 1. Tab is not a Chrome internal page
 * 2. Content script is properly injected
 */
const isTabInspectable = async (tabId: number): Promise<boolean> => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return false;
    }

    const [isInjected] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.hasOwnProperty('__DOM_INSPECTOR_INITIALIZED__'),
    });

    return isInjected?.result || false;
  } catch (error) {
    sidePanelErrorLog('Error checking tab inspectability:', error);
    return false;
  }
};

/**
 * Injects the content script into a tab with error handling
 */
const injectContentScript = async (tabId: number): Promise<boolean> => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['contentScript.js']
    });
    return true;
  } catch (error) {
    sidePanelErrorLog('Error injecting content script:', error);
    return false;
  }
};

/**
 * Sends a message to content script with timeout and error handling
 */
const sendTabMessage = async (tabId: number, message: any): Promise<any> => {
  try {
    return await Promise.race([
      new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Message timeout')), 5000))
    ]);
  } catch (error) {
    sidePanelErrorLog('sending message:', error);
    throw error;
  }
};

/**
 * Main Side Panel component that provides the DOM inspection interface
 * Manages state for selected elements, navigation history, and tab communication
 * 
 * @component
 */
const SidePanel: React.FC = () => {
  // State management
  const [currentElement, setCurrentElement] = useState<DOMElement | null>(null);
  const [elementStack, setElementStack] = useState<DOMElement[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  /**
   * Resets component state with optional display updates
   */
  const resetState = useCallback(() => {
    setCurrentElement(null);
    setElementStack([]);
  }, []);

  /**
   * Cleans up extension state in active tab
   */
  const cleanup = useCallback(async () => {
    if (!activeTabId) return;
    try {
      await sendTabMessage(activeTabId, { type: 'CLEANUP_EXTENSION' });
    } catch (error) {
      sidePanelErrorLog('during cleanup:', error);
    }
  }, [activeTabId]);

  /**
   * Initializes side panel for a specific tab:
   * 1. Checks tab inspectability
   * 2. Injects content script if needed
   * 3. Activates extension
   * 4. Retrieves initial DOM state
   */
  const initializeSidePanel = useCallback(async (tabId: number) => {
    if (isInitializing) {
      await cleanup();
    }

    setIsInitializing(true);

    try {
      sidePanelDebugLog('Initializing side panel for tab:', tabId);

      const tab = await chrome.tabs.get(tabId);
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
        sidePanelErrorLog('Chrome internal pages cannot be inspected');
        return false;
      }

      resetState();

      if (!(await isTabInspectable(tabId))) {
        if (!(await injectContentScript(tabId))) {
          sidePanelErrorLog('Failed to inject content script');
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (activeTabId && activeTabId !== tabId) {
        await cleanup();
      }

      setActiveTabId(tabId);

      await sendTabMessage(tabId, { type: 'ACTIVATE_EXTENSION' });
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await sendTabMessage(tabId, { type: 'GET_INITIAL_DOM' });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get initial DOM');
      }
      return true;
    } catch (error) {
      sidePanelErrorLog('initializing side panel:', error);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [activeTabId, cleanup, resetState, isInitializing]);

  /**
   * Handles visibility change events for the side panel window
   * Triggers cleanup when panel becomes hidden
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      sidePanelDebugLog('Side panel hidden, running cleanup');
      cleanup();
    }
  }, [cleanup]);

  /**
   * Handles beforeunload events for the side panel window
   * Ensures cleanup runs before panel is closed
   */
  const handleBeforeUnload = useCallback(() => {
    sidePanelDebugLog('beforeunload event triggered');
    cleanup();
  }, [cleanup]);

  /**
   * Main initialization effect
   * Sets up event listeners, message handlers, and initial DOM state
   */
  useEffect(() => {
    sidePanelDebugLog('Initializing side panel');
    let isComponentMounted = true;
    
    const handleTabChange = async (activeInfo: chrome.tabs.TabActiveInfo) => {
      if (!isComponentMounted) return;
      sidePanelDebugLog('Tab changed:', activeInfo.tabId);
      await initializeSidePanel(activeInfo.tabId);
    };

    const handleTabUpdated = async (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (!isComponentMounted || !tab.active) return;

      // Only reinitialize if the URL has changed or the page has finished loading
      if (changeInfo.url || changeInfo.status === 'complete') {
        sidePanelDebugLog('Active tab updated:', tabId);
        await initializeSidePanel(tabId);
      }
    };

    // Initialize current tab
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs[0]?.id && isComponentMounted) {
          initializeSidePanel(tabs[0].id);
        }
      })
      .catch(error => sidePanelErrorLog('querying active tab:', error));

    // Set up all event listeners
    chrome.tabs.onActivated.addListener(handleTabChange);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    /**
     * Handles incoming messages from the content script
     * Updates component state based on message content
     * 
     * @param message - Message received from content script
     * @param sender - Message sender information
     * @param sendResponse - Function to send response back
     * @returns Boolean indicating if response is handled asynchronously
     */
    const messageListener = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      sidePanelDebugLog('Received message:', message);
      
      if (message.type === 'DOM_ELEMENT_UPDATE' && isComponentMounted) {
        setCurrentElement(message.element);
      }
      sendResponse({ received: true });
      return false;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      sidePanelDebugLog('Cleaning up side panel');
      isComponentMounted = false;
      chrome.tabs.onActivated.removeListener(handleTabChange);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.runtime.onMessage.removeListener(messageListener);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
    };
  }, [cleanup, handleBeforeUnload, handleVisibilityChange]);

  /**
   * Navigates to and selects a child element in the DOM tree
   * Updates navigation history and current element state
   * 
   * @param childElement - Target child element to navigate to
   */
  const navigateToChild = async (childElement: DOMElement) => {
    if (!activeTabId) {
      sidePanelDebugLog('No active tab ID available');
      return;
    }

    try {
      sidePanelDebugLog('Navigating to child element:', childElement);
      await sendTabMessage(activeTabId, {
        type: 'SELECT_ELEMENT',
        path: childElement.path
      });
      
      if (currentElement) {
        setElementStack((prev) => [...prev, currentElement]);
      }
      setCurrentElement(childElement);
    } catch (error) {
      sidePanelErrorLog('navigating to child:', error);
    }
  };

  /**
   * Temporarily highlights a child element for preview
   * Does not change current selection or navigation history
   * 
   * @param childElement - Element to preview
   */
  const previewChildElement = async (childElement: DOMElement) => {
    if (!activeTabId) return;
    
    try {
      sidePanelDebugLog('Previewing child element:', childElement);
      await sendTabMessage(activeTabId, {
        type: 'PREVIEW_ELEMENT',
        path: childElement.path
      });
    } catch (error) {
      sidePanelErrorLog('previewing child:', error);
    }
  };

  /**
   * Navigates to the parent element of the current selection
   * Updates navigation history
   */
  const navigateToParent = async () => {
    if (!activeTabId || !currentElement || currentElement.path.length <= 1) {
      sidePanelDebugLog('Cannot navigate to parent - no parent element available');
      return;
    }

    try {
      sidePanelDebugLog('Navigating to parent element');
      const parentPath = currentElement.path.slice(0, -1);
      
      await sendTabMessage(activeTabId, {
        type: 'SELECT_ELEMENT',
        path: parentPath
      });
      
      setElementStack((prev) => [...prev, currentElement]);
    } catch (error) {
      sidePanelErrorLog('navigating to parent:', error);
    }
  };

  /**
   * Clears any active element preview
   * Restores the display of the currently selected element
   */
  const clearElementPreview = async () => {
    if (!activeTabId) return;

    try {
      await sendTabMessage(activeTabId, {
        type: 'CLEAR_PREVIEW'
      });
    } catch (error) {
      sidePanelErrorLog('clearing preview:', error);
    }
  };

  /**
   * Navigates back to the previously selected element
   * Updates navigation history stack
   */
  const navigateBack = async () => {
    if (!activeTabId) {
      sidePanelDebugLog('No active tab ID available');
      return;
    }

    const prevElement = elementStack[elementStack.length - 1];
    if (!prevElement) return;

    try {
      sidePanelDebugLog('Navigating back');
      await sendTabMessage(activeTabId, {
        type: 'SELECT_ELEMENT',
        path: prevElement.path
      });
      
      setElementStack((prev) => prev.slice(0, -1));
      setCurrentElement(prevElement);
    } catch (error) {
      sidePanelErrorLog('navigating back:', error);
    }
  };

  return (
    <div className="sidepanel">
      <div className="sidepanel-header">
        <h1 className="sidepanel-title">DOM Inspector</h1>
        <div className="sidepanel-button-group">
          <button
            onClick={navigateToParent}
            className="sidepanel-button"
            disabled={!currentElement || currentElement.path.length <= 1}
            data-tooltip-id="button-tooltip"
            data-tooltip-content="Move to parent element"
          >
            <ArrowUp size={16} />
          </button>
          <button
            onClick={navigateBack}
            className="sidepanel-button"
            disabled={!currentElement || elementStack.length === 0}
            data-tooltip-id="button-tooltip"
            data-tooltip-content="Undo last selection"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={() => activeTabId && initializeSidePanel(activeTabId)}
            className="sidepanel-button"
            disabled={isInitializing || !activeTabId}
            data-tooltip-id="button-tooltip"
            data-tooltip-content="Reinitialize inspector"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {isInitializing ? (
        <div className="sidepanel-loading">
          <div className="sidepanel-loading-content">
            <Loader2 className="animate-spin" size={24} />
            <p className="sidepanel-loading-text">Initializing...</p>
          </div>
        </div>
      ) : currentElement ? (
        <div className="sidepanel-content">
          <div className="sidepanel-element">
            <h2 className="sidepanel-element-title">Selected Element</h2>
            <div className="sidepanel-element-details">
              <p>Tag: {currentElement.tag}</p>
              {currentElement.id && <p>ID: {currentElement.id}</p>}
              {currentElement.classes && currentElement.classes.length > 0 && (
                <p>Classes: {currentElement.classes.join(' ')}</p>
              )}
              <p className="sidepanel-element-path">
                Path: [{currentElement.path.join(', ')}]
              </p>
            </div>
          </div>

          {currentElement.children.length > 0 && (
            <div>
              <h3 className="sidepanel-children-title">Child Elements</h3>
              <DOMTreeView
                element={currentElement}
                onNodeSelect={navigateToChild}
                onNodePreview={previewChildElement}
                onClearPreview={clearElementPreview}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="sidepanel-empty">
          <p>Select an element to inspect</p>
        </div>
      )}

      <Tooltip
        id="button-tooltip"
        place="bottom"
      />
    </div>
  );
};

/**
 * Type declarations for component props and dependencies
 * @example
 * ```typescript
 * interface DOMElement {
 *   tag: string;
 *   id?: string;
 *   classes?: string[];
 *   children: DOMElement[];
 *   path: number[];
 * }
 * 
 * interface DOMTreeViewProps {
 *   element: DOMElement;
 *   onNodeSelect: (element: DOMElement) => void;
 *   onNodePreview: (element: DOMElement) => void;
 *   onClearPreview: () => void;
 * }
 * ```
 */

export default SidePanel;