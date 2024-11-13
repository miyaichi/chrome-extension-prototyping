/**
 * Side Panel component for DOM Inspector Chrome extension
 * Provides a user interface for inspecting and navigating DOM elements
 * @module SidePanel
 */

import { ArrowUp, Eye, Undo } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Tooltip } from 'react-tooltip';
import DOMTreeView from './DOMTreeView';

/**
 * Represents a DOM element in the inspector's tree view
 */
interface DOMElement {
  /** HTML tag name of the element */
  tag: string;
  /** Element's ID attribute if present */
  id?: string;
  /** Array of element's CSS classes */
  classes?: string[];
  /** Combined text content of the element */
  textContent?: string;
  /** Array of child elements */
  children: DOMElement[];
  /** Array representing the element's path in the DOM tree */
  path: number[];
}

/**
 * Logs debug messages with side panel prefix
 * @param message - Main message to log
 * @param args - Additional arguments to log
 */
function sidePanelDebugLog(message: string, ...args: any[]): void {
  console.log(`[Side Panel] ${message}`, ...args);
}

/**
 * Logs error messages with side panel prefix
 * @param message - Main error message to log
 * @param args - Additional arguments to log
 */
function sidePanelErrorLog(message: string, ...args: any[]): void {
  console.error(`[Side Panel] ${message}`, ...args);
}

/**
 * Sends a message to a specific tab and returns the response
 * @param tabId - ID of the target tab
 * @param message - Message to send
 * @returns Promise resolving with the response
 * @throws Error if message sending fails
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
 * Main side panel component for the DOM Inspector
 * Manages the state and interaction with the inspected webpage
 */
const SidePanel: React.FC = () => {
  /** Currently selected DOM element */
  const [currentElement, setCurrentElement] = useState<DOMElement | null>(null);
  /** Stack of previously selected elements for navigation history */
  const [elementStack, setElementStack] = useState<DOMElement[]>([]);
  /** Toggle for showing additional element details */
  const [showDetails, setShowDetails] = useState(false);
  /** ID of the currently active tab */
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  /**
   * Cleans up the extension state in the active tab
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
   * Handles visibility change events for the side panel
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      sidePanelDebugLog('Side panel hidden, running cleanup');
      cleanup();
    }
  }, [cleanup]);

  /**
   * Handles beforeunload events
   */
  const handleBeforeUnload = useCallback(() => {
    sidePanelDebugLog('beforeunload event triggered');
    cleanup();
  }, [cleanup]);

  /**
   * Main effect for initializing the side panel and setting up event listeners
   */
  useEffect(() => {
    sidePanelDebugLog('Initializing side panel');
    let isComponentMounted = true;
    
    /**
     * Initializes the active tab and DOM structure
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

    initializeSidePanel();

    /**
     * Handles messages from the content script
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
   * Navigates to and selects a child element
   * @param childElement - Child element to navigate to
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
   * Previews a child element by highlighting it
   * @param childElement - Child element to preview
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
   * Navigates to the parent of the current element
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
   * Clears the preview highlight from elements
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
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            data-tooltip-id="button-tooltip"
            data-tooltip-content="Toggle details"
          >
            <Eye size={20} />
          </button>
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
              {showDetails && currentElement.textContent && (
                <p className="truncate">
                  Text: {currentElement.textContent}
                </p>
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

export default SidePanel;