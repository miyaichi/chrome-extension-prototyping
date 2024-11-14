/**
 * Content script for Chrome extension that handles DOM element selection and highlighting
 * @module contentScript
 */

import { DOMElement } from '../types';

// Style constants
const STYLES = {
  HIGHLIGHT: {
    outline: '2px solid #4CAF50',
    outlineOffset: '-2px'
  },
  PREVIEW: {
    outline: '2px dashed #4CAF50',
    outlineOffset: '-2px'
  },
  NONE: {
    outline: '',
    outlineOffset: ''
  }
} as const;
const HIGHLIGHT_COLOR_RGB = 'rgb(76, 175, 80)'; // #4CAF50
const STYLE_CHECK_INTERVAL = 2000; // ms

// State variables
let highlightedElement: HTMLElement | null = null;
let previewElement: HTMLElement | null = null;
let clickHandler: ((event: Event) => void) | null = null;
let isActive = false;

/**
 * Logs debug messages with content script prefix
 * @param message - Main message to log
 * @param args - Additional arguments to log
 */
function contentScriptDebugLog(message: string, ...args: any[]): void {
  console.log(`[Content Script] ${message}`, ...args);
}

/**
 * Logs error messages with content script prefix
 * @param message - Main error message to log
 * @param args - Additional arguments to log
 */
function contentScriptErrorLog(message: string, ...args: any[]): void {
  console.error(`[Content Script] ${message}`, ...args);
}

/**
 * Serializes a DOM element into a plain object structure
 * @param element - DOM element to serialize
 * @param currentPath - Current path in the DOM tree
 * @returns Serialized representation of the element
 */
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

  const nonTextChildren = Array.from(element.children);
  serialized.children = nonTextChildren.map((child, index) => {
    const childPath = [...currentPath, index];
    return serializeDOMElement(child, childPath);
  });

  return serialized;
}

/**
 * Finds a DOM element using a path array
 * @param path - Array of indices representing the path to the element
 * @returns The found element or null if not found
 */
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
        contentScriptErrorLog('Invalid path index:', index);
        return null;
      }
    }
    return element;
  } catch (error) {
    contentScriptErrorLog('Error finding element:', error);
    return null;
  }
}

/**
 * Apply element styles
 * @param element - Element to apply style to
 * @param styles - Applied style
 */
function applyStyles(element: HTMLElement, styles: typeof STYLES[keyof typeof STYLES]): void {
  element.style.outline = styles.outline;
  element.style.outlineOffset = styles.outlineOffset;
}

/**
 * Removes highlight styling from the currently highlighted element
 */
function removeHighlight(): void {
  if (highlightedElement) {
    applyStyles(highlightedElement, STYLES.NONE);
    highlightedElement = null;
  }
}

/**
 * Removes preview styling from the currently previewed element
 */
function removePreview(): void {
  if (previewElement) {
    applyStyles(previewElement, STYLES.NONE);
    previewElement = null;
  }
}

/**
 * Applies preview highlighting to an element
 * @param element - Element to preview highlight
 */
function previewHighlight(element: HTMLElement): void {
  if (element === previewElement) return;

  removePreview();
  previewElement = element;
  applyStyles(element, STYLES.PREVIEW);
}

/**
 * Applies highlight styling to an element and scrolls it into view
 * @param element - Element to highlight
 */
function highlightElement(element: HTMLElement): void {
  if (element === highlightedElement) return;

  removeHighlight();
  removePreview();
  highlightedElement = element;
  applyStyles(element, STYLES.HIGHLIGHT);
  
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest'
  });
}

/**
 * Gets the path to an element in the DOM tree
 * @param element - Element to get path for
 * @returns Array of indices representing the path
 */
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

/**
 * Sends DOM element update to the extension
 * @param element - Element that was updated
 * @param path - Path to the element
 */
function sendDOMUpdate(element: Element, path: number[]): void {
  try {
    chrome.runtime.sendMessage({
      type: 'DOM_ELEMENT_UPDATE',
      element: serializeDOMElement(element, path)
    });
  } catch (error) {
    contentScriptErrorLog('Error sending DOM update:', error);
  }
}

/**
 * Handles click events on the page
 * @param event - Click event
 */
function handleClick(event: Event): void {
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

/**
 * Handles messages from the extension
 * @param message - Message received
 * @param sender - Sender of the message
 * @param sendResponse - Function to send response
 * @returns Boolean indicating if response is handled synchronously
 */
function handleMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  contentScriptDebugLog('Received message:', message.type);
  
  try {
    switch (message.type) {
      case 'ACTIVATE_EXTENSION': {
        contentScriptDebugLog('Activating extension');
        isActive = true;
        attachEventListeners();
        sendDOMUpdate(document.documentElement, []);
        sendResponse({ success: true });
        break;
      }

      case 'DEACTIVATE_EXTENSION': {
        contentScriptDebugLog('Deactivating extension');
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
        contentScriptDebugLog('Cleaning up extension');
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
    contentScriptErrorLog('Error handling message:', error);
    sendResponse({ success: false, error: String(error) });
  }

  return false; // return sync response
}

/**
 * Attaches event listeners for the extension
 */
function attachEventListeners(): void {
  contentScriptDebugLog('Attaching event listeners');

  clickHandler = handleClick;
  document.addEventListener('click', clickHandler, true);
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', cleanup);

  const port = chrome.runtime.connect({ name: 'content-script-connection' });
  port.onDisconnect.addListener(() => {
    contentScriptDebugLog('Port disconnected');
    cleanup();
  });

  contentScriptDebugLog('Event listeners attached');
}

/**
 * Handles visibility change events
 */
function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    cleanup();
  }
}

/**
 * Cleans up the extension state and removes event listeners
 */
function cleanup(): void {
  contentScriptDebugLog('Running cleanup');

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
    contentScriptErrorLog('Error during cleanup:', error);
  }

  contentScriptDebugLog('Cleanup complete');
}

/**
 * Initializes the content script
 */
function initialize(): void {
  contentScriptDebugLog('Initializing');
  chrome.runtime.onMessage.addListener(handleMessage);
  contentScriptDebugLog('Initialization complete - awaiting activation');

  // Check the style of the highlighted element egularly.
  setInterval(() => {
    if (!isActive || !highlightedElement) return;

    const computedStyle = window.getComputedStyle(highlightedElement);
    const hasHighlight = computedStyle.outline.includes(HIGHLIGHT_COLOR_RGB);

    if (!hasHighlight) {
      console.warn('[Style Monitor] Highlight style lost:', {
        element: highlightedElement.tagName,
        id: highlightedElement.id,
        currentOutline: computedStyle.outline,
        timestamp: new Date().toISOString()
      });

      // Reapply style
      applyStyles(highlightedElement, STYLES.HIGHLIGHT);
    }
  }, STYLE_CHECK_INTERVAL);
}

// Initialize the content script
initialize();