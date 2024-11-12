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
let messageListener: ((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void) | null = null;
let clickHandler: ((event: Event) => void) | null = null;
let isActive = false;

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
        console.error('Invalid path index:', index);
        return null;
      }
    }
    return element;
  } catch (error) {
    console.error('Error finding element:', error);
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

function handleClick(event: Event) {
  if (!isActive) return;

  if (event.target instanceof HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    
    const element = event.target;
    highlightElement(element);
    
    const path = getElementPath(element);
    
    chrome.runtime.sendMessage({
      type: 'DOM_ELEMENT_UPDATE',
      element: serializeDOMElement(element, path)
    });
  }
}

function handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  console.log('[Content Script] Received message:', message.type);
  
  switch (message.type) {
    case 'ACTIVATE_EXTENSION': {
      console.log('[Content Script] Activating extension for this tab');
      if (!isActive) {
        isActive = true;
        attachEventListeners();
        // Send initial DOM structure after activation
        const rootElement = serializeDOMElement(document.documentElement);
        chrome.runtime.sendMessage({
          type: 'DOM_ELEMENT_UPDATE',
          element: rootElement
        });
      }
      break;
    }

    case 'DEACTIVATE_EXTENSION': {
      console.log('[Content Script] Deactivating extension for this tab');
      cleanup();
      break;
    }

    case 'GET_INITIAL_DOM': {
      if (!isActive) return;
      const rootElement = serializeDOMElement(document.documentElement);
      chrome.runtime.sendMessage({
        type: 'DOM_ELEMENT_UPDATE',
        element: rootElement
      });
      break;
    }

    case 'SELECT_ELEMENT': {
      if (!isActive) return;
      const element = findElementByPath(message.path);
      if (element instanceof HTMLElement) {
        highlightElement(element);
        chrome.runtime.sendMessage({
          type: 'DOM_ELEMENT_UPDATE',
          element: serializeDOMElement(element, message.path)
        });
      }
      break;
    }

    case 'PREVIEW_ELEMENT': {
      if (!isActive) return;
      const element = findElementByPath(message.path);
      if (element instanceof HTMLElement) {
        previewHighlight(element);
      }
      break;
    }
      
    case 'CLEAR_PREVIEW': {
      if (!isActive) return;
      removePreview();
      if (highlightedElement) {
        highlightElement(highlightedElement);
      }
      break;
    }
      
    case 'CLEANUP_EXTENSION': {
      console.log('[Content Script] Received cleanup request');
      cleanup();
      sendResponse({ success: true });
      break;
    }
  }

  return true;
}

function attachEventListeners() {
  console.log('[Content Script] Attaching event listeners');

  // Store references to event handlers
  clickHandler = handleClick;

  // Add event listeners
  document.addEventListener('click', clickHandler, true);
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', cleanup);

  // Create a connection to the extension
  const port = chrome.runtime.connect({ name: 'content-script-connection' });
  
  // Listen for disconnection
  port.onDisconnect.addListener(() => {
    console.log('[Content Script] Port disconnected');
    cleanup();
  });

  console.log('[Content Script] Event listeners attached');
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    cleanup();
  }
}

function cleanup() {
  console.log('[Content Script] Running cleanup');

  try {
    isActive = false;

    // Remove visual highlights
    if (highlightedElement || previewElement) {
      removeHighlight();
      removePreview();
      console.log('[Content Script] Removed highlights');
    }

    // Remove click handler
    if (clickHandler) {
      document.removeEventListener('click', clickHandler, true);
      clickHandler = null;
      console.log('[Content Script] Removed click handler');
    }

    // Remove other event listeners
    window.removeEventListener('pagehide', cleanup);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', cleanup);
    console.log('[Content Script] Removed window event listeners');

  } catch (error) {
    console.error('[Content Script] Error during cleanup:', error);
  }

  console.log('[Content Script] Cleanup complete');
}

function initialize() {
  console.log('[Content Script] Initializing');
  // Only set up message listener initially
  messageListener = handleMessage;
  chrome.runtime.onMessage.addListener(messageListener);
  console.log('[Content Script] Initialization complete - awaiting activation');
}

// Initialize the content script
initialize();