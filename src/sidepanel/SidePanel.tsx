// src/sidepanel/SidePanel.tsx
import { ArrowUp, Eye, Undo } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Tooltip } from 'react-tooltip';
import DOMTreeView from './DOMTreeView';

interface DOMElement {
  tag: string;
  id?: string;
  classes?: string[];
  textContent?: string;
  children: DOMElement[];
  path: number[];
}

function sidePanelDebugLog(message: string, ...args: any[]) {
  console.log(`[Side Panel] ${message}`, ...args);
}

function sidePanelErrorLog(message: string, ...args: any[]) {
  console.error(`[Side Panel] ${message}`, ...args);
}

// Chrome messaging utility
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

const SidePanel: React.FC = () => {
  const [currentElement, setCurrentElement] = useState<DOMElement | null>(null);
  const [elementStack, setElementStack] = useState<DOMElement[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

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

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      sidePanelDebugLog('Side panel hidden, running cleanup');
      cleanup();
    }
  }, [cleanup]);

  const handleBeforeUnload = useCallback(() => {
    sidePanelDebugLog('beforeunload event triggered');
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    sidePanelDebugLog('Initializing side panel');
    let isComponentMounted = true;
    
    // Initialize active tab and DOM structure
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

    // Message listener
    const messageListener = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      sidePanelDebugLog('Received message:', message);
      
      if (message.type === 'DOM_ELEMENT_UPDATE' && isComponentMounted) {
        setCurrentElement(message.element);
      }
      // Always send a response
      sendResponse({ received: true });
      return false; // Return false to indicate that the response will be sent asynchronously
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      sidePanelDebugLog('Cleaning up side panel');
      isComponentMounted = false;
      chrome.runtime.onMessage.removeListener(messageListener);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
    };
  }, [cleanup, handleBeforeUnload, handleVisibilityChange]);

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