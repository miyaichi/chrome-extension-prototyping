// src/sidepanel/SidePanel.tsx
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    debugLog('Initializing side panel');
    
    // Get the active tab ID
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        debugLog('Active tab ID:', tabs[0].id);
        setActiveTabId(tabs[0].id);
        
        // Request initial DOM structure
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_INITIAL_DOM' });
      }
    });

    // Listen for DOM updates from content script
    const messageListener = (message: any, sender: chrome.runtime.MessageSender) => {
      debugLog('Received message:', message);
      if (message.type === 'DOM_ELEMENT_UPDATE') {
        debugLog('Updating current element:', message.element);
        setCurrentElement(message.element);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Cleanup listener and connection on unmount
    return () => {
      debugLog('Cleaning up side panel');
      chrome.runtime.onMessage.removeListener(messageListener);
      
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'CLEANUP_EXTENSION' })
          .catch(error => {
            debugLog('Error sending cleanup message:', error);
          });
      }
    };
  }, []);

  const handleElementSelect = (element: DOMElement) => {
    debugLog('Element selected:', element);
    debugLog('Element path:', element.path);

    if (!activeTabId) {
      debugLog('No active tab ID available');
      return;
    }

    if (currentElement) {
      setElementStack((prev) => [...prev, currentElement]);
    }
    setCurrentElement(element);

    chrome.tabs.sendMessage(activeTabId, {
      type: 'SELECT_ELEMENT',
      path: element.path
    }).catch(error => {
      debugLog('Error sending selection message:', error);
    });
  };

  const handleElementHover = (element: DOMElement) => {
    if (!activeTabId) return;
    
    debugLog('Element hover:', element);
    chrome.tabs.sendMessage(activeTabId, {
      type: 'PREVIEW_ELEMENT',
      path: element.path
    }).catch(error => {
      debugLog('Error sending preview message:', error);
    });
  };

  const handleElementLeave = () => {
    if (!activeTabId) return;

    chrome.tabs.sendMessage(activeTabId, {
      type: 'CLEAR_PREVIEW'
    }).catch(error => {
      debugLog('Error sending clear preview message:', error);
    });
  };

  const handleBack = () => {
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
            title="Toggle details"
          >
            <Eye size={20} />
          </button>
          {elementStack.length > 0 && (
            <button
              onClick={handleBack}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
          )}
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
                    onClick={() => handleElementSelect(child)}
                    onMouseEnter={() => handleElementHover(child)}
                    onMouseLeave={handleElementLeave}
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
    </div>
  );
};

export default SidePanel;