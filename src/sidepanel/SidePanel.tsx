// src/sidepanel/SidePanel.tsx
import { ArrowUp, ChevronRight, Eye, Undo } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Tooltip } from 'react-tooltip';

interface DOMElement {
  tag: string;
  id?: string;
  classes?: string[];
  textContent?: string;
  children: DOMElement[];
  path: number[];
}

function debugLog(message: string, ...args: any[]) {
  console.log(`[DOM Inspector Panel] ${message}`, ...args);
}

const SidePanel: React.FC = () => {
  const [currentElement, setCurrentElement] = useState<DOMElement | null>(null);
  const [elementStack, setElementStack] = useState<DOMElement[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  const cleanup = useCallback(() => {
    debugLog('Running cleanup');
    if (activeTabId) {
      chrome.tabs.sendMessage(
        activeTabId, 
        { type: 'CLEANUP_EXTENSION' },
        (response) => {
          if (chrome.runtime.lastError) {
            debugLog('Error during cleanup:', chrome.runtime.lastError);
          } else {
            debugLog('Cleanup completed successfully:', response);
          }
        }
      );
    }
  }, [activeTabId]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      debugLog('Side panel hidden, running cleanup');
      cleanup();
    }
  }, [cleanup]);

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    debugLog('beforeunload event triggered');
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    debugLog('Initializing side panel');
    let isComponentMounted = true;
    
    // Get the active tab ID
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!isComponentMounted) return;
      
      if (tabs[0]?.id) {
        debugLog('Active tab ID:', tabs[0].id);
        setActiveTabId(tabs[0].id);
        
        // Request initial DOM structure
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_INITIAL_DOM' })
          .catch(error => debugLog('Error getting initial DOM:', error));
      }
    });

    // Listen for DOM updates from content script
    const messageListener = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      debugLog('Received message:', message);
      
      if (message.type === 'DOM_ELEMENT_UPDATE' && isComponentMounted) {
        setCurrentElement(message.element);
        sendResponse({ received: true });
        return false;
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      debugLog('Cleaning up side panel');
      isComponentMounted = false;
      chrome.runtime.onMessage.removeListener(messageListener);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
    };
  }, [cleanup, handleBeforeUnload, handleVisibilityChange]);

  // Navigate to the clicked child element
  const navigateToChild = (childElement: DOMElement) => {
    debugLog('Navigating to child element:', childElement);
    debugLog('Child element path:', childElement.path);

    if (!activeTabId) {
      debugLog('No active tab ID available');
      return;
    }

    if (currentElement) {
      setElementStack((prev) => [...prev, currentElement]);
    }
    setCurrentElement(childElement);

    chrome.tabs.sendMessage(activeTabId, {
      type: 'SELECT_ELEMENT',
      path: childElement.path
    }).catch(error => {
      debugLog('Error sending selection message:', error);
    });
  };

  // Preview the child element on hover
  const previewChildElement = (childElement: DOMElement) => {
    if (!activeTabId) return;
    
    debugLog('Previewing child element:', childElement);
    chrome.tabs.sendMessage(activeTabId, {
      type: 'PREVIEW_ELEMENT',
      path: childElement.path
    }).catch(error => {
      debugLog('Error sending preview message:', error);
    });
  };

  // Navigate to the parent element
  const navigateToParent = () => {
    if (!activeTabId || !currentElement || currentElement.path.length <= 1) {
      debugLog('Cannot navigate to parent - no parent element available');
      return;
    }

    debugLog('Navigating to parent element');
    const parentPath = currentElement.path.slice(0, -1);

    setElementStack((prev) => [...prev, currentElement]);
    
    chrome.tabs.sendMessage(activeTabId, {
      type: 'SELECT_ELEMENT',
      path: parentPath
    }).catch(error => {
      debugLog('Error sending parent navigation message:', error);
    });
  };
  
  // Clear the child element preview
  const clearElementPreview = () => {
    if (!activeTabId) return;

    chrome.tabs.sendMessage(activeTabId, {
      type: 'CLEAR_PREVIEW'
    }).catch(error => {
      debugLog('Error sending clear preview message:', error);
    });
  };

  // Undo the last navigation
  const navigateBack = () => {
    if (!activeTabId) {
      debugLog('No active tab ID available');
      return;
    }

    debugLog('Navigating back');
    const prevElement = elementStack[elementStack.length - 1];
    
    if (prevElement) {
      debugLog('Previous element:', prevElement);
      setElementStack((prev) => prev.slice(0, -1));
      setCurrentElement(prevElement);

      chrome.tabs.sendMessage(activeTabId, {
        type: 'SELECT_ELEMENT',
        path: prevElement.path
      }).catch(error => {
        debugLog('Error sending back navigation message:', error);
      });
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
              <div className="space-y-1">
                {currentElement.children.map((child, index) => (
                  <button
                    key={index}
                    onClick={() => navigateToChild(child)}
                    onMouseEnter={() => previewChildElement(child)}
                    onMouseLeave={clearElementPreview}
                    className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center justify-between"
                  >
                    <span>
                      {child.tag}
                      {child.id && `#${child.id}`}
                      {child.classes && child.classes.length > 0 && `.${child.classes[0]}`}
                    </span>
                    {child.children.length > 0 && <ChevronRight size={16} />}
                  </button>
                ))}
              </div>
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