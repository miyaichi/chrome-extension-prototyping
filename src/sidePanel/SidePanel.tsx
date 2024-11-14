/**
 * Side Panel component for DOM Inspector Chrome extension.
 * Provides a user interface for inspecting and navigating DOM elements in the active tab.
 * Features include:
 * - Displaying current element properties and structure
 * - Navigation through DOM hierarchy
 * - Element preview functionality
 * - Navigation history management
 * 
 * @module SidePanel
 * @requires react
 * @requires lucide-react
 * @requires react-tooltip
 */

import { ArrowUp, Undo } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { DOMElement } from '../types';
import DOMTreeView from './DOMTreeView';

/**
 * Debug logging utility for side panel operations
 * Prefixes all log messages with [Side Panel] for easier debugging
 * 
 * @param message - Primary message to log
 * @param args - Additional arguments to include in log
 */
function sidePanelDebugLog(message: string, ...args: any[]): void {
  console.log(`[Side Panel] ${message}`, ...args);
}

/**
 * Error logging utility for side panel operations
 * Prefixes all error messages with [Side Panel] for easier debugging
 * 
 * @param message - Primary error message to log
 * @param args - Additional arguments to include in error log
 */
function sidePanelErrorLog(message: string, ...args: any[]): void {
  console.error(`[Side Panel] ${message}`, ...args);
}

/**
 * Sends a message to the content script in a specific tab
 * Handles Chrome extension messaging with proper error handling
 * 
 * @param tabId - Chrome tab ID to send message to
 * @param message - Message object to send to the content script
 * @returns Promise resolving to the response from the content script
 * @throws Error if message sending fails or runtime error occurs
 */
const sendTabMessage = async (tabId: number, message: any): Promise<any> => {
  try {
    return await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
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
  /** State for currently selected DOM element */
  const [currentElement, setCurrentElement] = useState<DOMElement | null>(null);
  
  /** Navigation history stack of previously selected elements */
  const [elementStack, setElementStack] = useState<DOMElement[]>([]);
  
  /** ID of the currently active Chrome tab being inspected */
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  /**
   * Cleans up extension state in the active tab
   * Sends cleanup message to content script
   * 
   * @returns Promise that resolves when cleanup is complete
   */
  const cleanup = useCallback(async () => {
    sidePanelDebugLog('Running cleanup');
    if (!activeTabId) return;

    try {
      const response = await sendTabMessage(activeTabId, { type: 'CLEANUP_EXTENSION' });
      sidePanelDebugLog('Cleanup completed successfully:', response);
    } catch (error) {
      sidePanelErrorLog('during cleanup:', error);
    }
  }, [activeTabId]);

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
    
    /**
     * Initializes the active tab and retrieves initial DOM structure
     * @async
     */
    const initializeSidePanel = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!isComponentMounted || !tabs[0]?.id) return;
        
        const tabId = tabs[0].id;
        sidePanelDebugLog('Active tab ID:', tabId);
        setActiveTabId(tabId);
        
        await sendTabMessage(tabId, { type: 'GET_INITIAL_DOM' });
      } catch (error) {
        sidePanelErrorLog('initializing side panel:', error);
      }
    };

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

    initializeSidePanel();
    chrome.runtime.onMessage.addListener(messageListener);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      sidePanelDebugLog('Cleaning up side panel');
      isComponentMounted = false;
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
    <div className="h-full w-full bg-white dark:bg-gray-800 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">DOM Inspector</h1>
        <div className="flex gap-2">
          <button
            onClick={navigateToParent}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            disabled={!currentElement || currentElement.path.length <= 1}
            data-tooltip-id="button-tooltip"
            data-tooltip-content="Move to parent element"
          >
            <ArrowUp size={20} />
          </button>
          <button
            onClick={navigateBack}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            disabled={!currentElement || elementStack.length === 0}
            data-tooltip-id="button-tooltip"
            data-tooltip-content="Undo last selection"
          >
            <Undo size={20} />
          </button>
        </div>
      </div>

      {currentElement && (
        <div className="flex-1 overflow-auto">
          <div className="mb-4 p-3 border rounded">
            <h2 className="font-semibold mb-2">Selected Element</h2>
            <div className="space-y-1 text-sm">
              <p>Tag: {currentElement.tag}</p>
              {currentElement.id && <p>ID: {currentElement.id}</p>}
              {currentElement.classes && currentElement.classes.length > 0 && (
                <p>Classes: {currentElement.classes.join(' ')}</p>
              )}
              <p className="text-gray-500 text-xs">
                Path: [{currentElement.path.join(', ')}]
              </p>
            </div>
          </div>

          {currentElement.children.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Child Elements</h3>
              <DOMTreeView
                element={currentElement}
                onNodeSelect={navigateToChild}
                onNodePreview={previewChildElement}
                onClearPreview={clearElementPreview}
              />
            </div>
          )}
        </div>
      )}
      <Tooltip
        id="button-tooltip"
        place="bottom"
        style={{ backgroundColor: '#333', color: '#fff' }}
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