// src/contentScript/contentScript.ts

interface DOMElement {
  tag: string;
  id?: string;
  classes?: string[];
  textContent?: string;
  children: DOMElement[];
  path: number[];
}

let highlightedElement: HTMLElement | null = null;
let previewElement: HTMLElement | null = null;
let clickHandler: ((event: Event) => void) | null = null;
let isActive = false;

function debugLog(message: string, ...args: any[]) {
  console.log(`[Content Script] ${message}`, ...args);
}

function serializeDOMElement(element: Element, currentPath: number[] = []): DOMElement {
  const serialized: DOMElement = {
    tag: element.tagName.toLowerCase(),
    children: [],
    path: currentPath
  };

  if (element.id) {
    serialized.id = element.id;
  }

  if (element.classList.length > 0) {
    serialized.classes = Array.from(element.classList);
  }

  const textContent = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent?.trim())
    .filter(text => text)
    .join(' ');

  if (textContent) {
    serialized.textContent = textContent;
  }

  const nonTextChildren = Array.from(element.children);
  serialized.children = nonTextChildren.map((child, index) => {
    const childPath = [...currentPath, index];
    return serializeDOMElement(child, childPath);
  });

  return serialized;
}

function findElementByPath(path: number[]): Element | null {
  if (!path.length) return document.documentElement;

  let element: Element = document.documentElement;

  try {
    for (const index of path) {
      const elements: Element[] = Array.from(element.children).filter((el: Element) => 
        el.nodeType === Node.ELEMENT_NODE
      );
      
      if (index >= 0 && index < elements.length) {
        element = elements[index];
      } else {
        console.error('[Content Script] Invalid path index:', index);
        return null;
      }
    }
    return element;
  } catch (error) {
    console.error('[Content Script] Error finding element:', error);
    return null;
  }
}

function removeHighlight() {
  if (highlightedElement) {
    highlightedElement.style.outline = '';
    highlightedElement.style.outlineOffset = '';
    highlightedElement = null;
  }
}

function removePreview() {
  if (previewElement) {
    previewElement.style.outline = '';
    previewElement.style.outlineOffset = '';
    previewElement = null;
  }
}

function previewHighlight(element: HTMLElement) {
  if (element === previewElement) return;

  removePreview();
  previewElement = element;
  element.style.outline = '2px dashed #4CAF50';
  element.style.outlineOffset = '-2px';
}

function highlightElement(element: HTMLElement) {
  if (element === highlightedElement) return;

  removeHighlight();
  removePreview();
  highlightedElement = element;
  element.style.outline = '2px solid #4CAF50';
  element.style.outlineOffset = '-2px';
  
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest'
  });
}

function getElementPath(element: Element): number[] {
  const path: number[] = [];
  let currentElement: Element | null = element;
  let parentElement: Element | null;
  
  while (currentElement && currentElement !== document.documentElement) {
    parentElement = currentElement.parentElement;
    if (!parentElement) break;
    
    const siblings: Element[] = Array.from(parentElement.children).filter((el: Element) => 
      el.nodeType === Node.ELEMENT_NODE
    );
    const index = siblings.indexOf(currentElement);
    
    if (index !== -1) {
      path.unshift(index);
    }
    
    currentElement = parentElement;
  }
  
  return path;
}

function sendDOMUpdate(element: Element, path: number[]) {
  try {
    chrome.runtime.sendMessage({
      type: 'DOM_ELEMENT_UPDATE',
      element: serializeDOMElement(element, path)
    });
  } catch (error) {
    console.error('[Content Script] Error sending DOM update:', error);
  }
}

function handleClick(event: Event) {
  if (!isActive) return;

  if (event.target instanceof HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    
    const element = event.target;
    highlightElement(element);
    const path = getElementPath(element);
    sendDOMUpdate(element, path);
  }
}

function handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  debugLog('Received message:', message.type);
  
  try {
    switch (message.type) {
      case 'ACTIVATE_EXTENSION': {
        debugLog('Activating extension');
        isActive = true;
        attachEventListeners();
        sendDOMUpdate(document.documentElement, []);
        sendResponse({ success: true });
        break;
      }

      case 'DEACTIVATE_EXTENSION': {
        debugLog('Deactivating extension');
        cleanup();
        sendResponse({ success: true });
        break;
      }

      case 'GET_INITIAL_DOM': {
        if (!isActive) {
          sendResponse({ success: false, error: 'Extension not active' });
          return false;
        }
        sendDOMUpdate(document.documentElement, []);
        sendResponse({ success: true });
        break;
      }

      case 'SELECT_ELEMENT': {
        if (!isActive) {
          sendResponse({ success: false, error: 'Extension not active' });
          return false;
        }
        const element = findElementByPath(message.path);
        if (element instanceof HTMLElement) {
          highlightElement(element);
          sendDOMUpdate(element, message.path);
        }
        sendResponse({ success: true });
        break;
      }

      case 'PREVIEW_ELEMENT': {
        if (!isActive) {
          sendResponse({ success: false, error: 'Extension not active' });
          return false;
        }
        const element = findElementByPath(message.path);
        if (element instanceof HTMLElement) {
          previewHighlight(element);
        }
        sendResponse({ success: true });
        break;
      }
        
      case 'CLEAR_PREVIEW': {
        if (!isActive) {
          sendResponse({ success: false, error: 'Extension not active' });
          return false;
        }
        removePreview();
        if (highlightedElement) {
          highlightElement(highlightedElement);
        }
        sendResponse({ success: true });
        break;
      }
        
      case 'CLEANUP_EXTENSION': {
        debugLog('Cleaning up extension');
        cleanup();
        sendResponse({ success: true });
        break;
      }

      default: {
        console.warn('[Content Script] Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    }
  } catch (error) {
    console.error('[Content Script] Error handling message:', error);
    sendResponse({ success: false, error: String(error) });
  }

  return false; // return sync response
}

function attachEventListeners() {
  debugLog('Attaching event listeners');

  clickHandler = handleClick;
  document.addEventListener('click', clickHandler, true);
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', cleanup);

  const port = chrome.runtime.connect({ name: 'content-script-connection' });
  port.onDisconnect.addListener(() => {
    debugLog('Port disconnected');
    cleanup();
  });

  debugLog('Event listeners attached');
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    cleanup();
  }
}

function cleanup() {
  debugLog('Running cleanup');

  try {
    isActive = false;

    if (highlightedElement || previewElement) {
      removeHighlight();
      removePreview();
    }

    if (clickHandler) {
      document.removeEventListener('click', clickHandler, true);
      clickHandler = null;
    }

    window.removeEventListener('pagehide', cleanup);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', cleanup);

  } catch (error) {
    console.error('[Content Script] Error during cleanup:', error);
  }

  debugLog('Cleanup complete');
}

function initialize() {
  debugLog('Initializing');
  chrome.runtime.onMessage.addListener(handleMessage);
  debugLog('Initialization complete - awaiting activation');
}

// Initialize the content script
initialize();