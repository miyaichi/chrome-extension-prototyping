/**
 * Content script module for Chrome extension that handles DOM element selection and highlighting.
 * This module provides functionality for:
 * - Selecting and highlighting DOM elements
 * - Serializing DOM elements for communication with the extension
 * - Managing element preview and highlight states
 * - Handling extension messaging and lifecycle
 * 
 * @module contentScript
 */

import { DOMElement } from '../types';

/**
 * Module configuration constants
 */
/** Color for hilighting selected elements */
const HILIGHT_COLOR = '#4CAF50';
/** Maximum number of reconnection attempts to background script */
const MAX_RECONNECT_ATTEMPTS = 3;
/** Delay between reconnection attempts (ms) */
const RECONNECT_DELAY = 2000;

/**
 * Module state variables
 */
/** Currently highlighted DOM element */
let highlightedElement: HTMLElement | null = null;
/** Currently previewed DOM element */
let previewElement: HTMLElement | null = null;
/** Click event handler function reference */
let clickHandler: ((event: Event) => void) | null = null;
/** Extension activation state */
let isActive = false;
/** Counter for background script reconnection attempts */
let reconnectAttempts = 0;
/** Timer for reconnection attempts */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// Utility functions
/** Debug logging with [Content Script] prefix */
const contentScriptDebugLog = (message: string, ...args: any[]): void => 
  console.log(`[Content Script] ${message}`, ...args);

/** Error logging with [Content Script] prefix */
const contentScriptErrorLog = (message: string, ...args: any[]): void => 
  console.error(`[Content Script] ${message}`, ...args);

/**
 * Creates a serializable representation of a DOM element
 * Traverses the element's children to create a complete tree structure
 * 
 * @param element - The DOM element to serialize
 * @param currentPath - Array of indices representing the element's position in DOM tree
 * @returns A serialized object representation of the element
 */
const serializeDOMElement = (element: Element, currentPath: number[] = []): DOMElement => {
  const serialized: DOMElement = {
    tag: '',
    firstElementHTML: '',
    children: [],
    path: currentPath
  };

  const clone = element.cloneNode(false) as HTMLElement;
  clearHilight(clone);

  serialized.tag = clone.tagName.toLowerCase();
  serialized.firstElementHTML = clone.outerHTML.split('>')[0] + '>';
  if (clone.id) {
    serialized.id = clone.id;
  }
  if (clone.classList.length > 0) {
    serialized.classes = Array.from(clone.classList);
  }

  const nonTextChildren = Array.from(element.children);
  serialized.children = nonTextChildren.map((child, index) => {
    const childPath = [...currentPath, index];
    return serializeDOMElement(child, childPath);
  });

  return serialized;
}

/**
 * Locates a DOM element using a path array of indices
 * Each index in the path represents a child index at that level of the DOM tree
 * 
 * @param path - Array of indices representing the path to desired element
 * @returns The located DOM element or null if not found
 */
const findElementByPath = (path: number[]): Element | null => {
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
 * Applies a highlight to an element using CSS outline property
 * 
 * @param element - Element to highlight
 * @param style - Style of the outline, either 'solid' or 'dashed'
 */
const applyHilight = (element: HTMLElement, style: 'solid' | 'dashed') => {
  element.style.outline = `2px ${style} ${HILIGHT_COLOR}`;
  element.style.outlineOffset = '-2px';
}

/**
 * Clears any existing highlight from an element
 * 
 * @param element - Element to clear highlight from
 */
const clearHilight = (element: HTMLElement) => {
  element.style.outline = '';
  element.style.outlineOffset = '';
}

/**
 * Removes highlight styling from the currently highlighted element
 * Resets the highlightedElement reference to null
 */
const removeHighlight = (): void => {
  if (highlightedElement) {
    clearHilight(highlightedElement);
    highlightedElement = null;
  }
}

/**
 * Removes preview styling from the currently previewed element
 * Resets the previewElement reference to null
 */
const removePreview = (): void => {
  if (previewElement) {
    clearHilight(previewElement);
    previewElement = null;
  }
}

/**
 * Applies preview highlighting to an element
 * Removes any existing preview before applying new preview
 * 
 * @param element - Element to apply preview highlight to
 */
const previewHighlight = (element: HTMLElement): void => {
  if (element === previewElement) return;

  removePreview();
  previewElement = element;
  applyHilight(element, 'dashed');
}

/**
 * Applies highlight styling to an element and scrolls it into view
 * Removes any existing highlight and preview before applying new highlight
 * 
 * @param element - Element to highlight
 */
const highlightElement = (element: HTMLElement): void => {
  if (element === highlightedElement) return;

  removeHighlight();
  removePreview();
  highlightedElement = element;
  applyHilight(element, 'solid');
  
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest'
  });
}

/**
 * Calculates the path to an element in the DOM tree
 * Path is represented as array of indices where each index represents
 * the position of the element among its siblings at that level
 * 
 * @param element - Element to calculate path for
 * @returns Array of indices representing the path from root to element
 */
const getElementPath = (element: Element): number[] => {
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
 * Sends a DOM element update message to the extension
 * Serializes the element and its path for transmission
 * 
 * @param element - Element that was updated
 * @param path - Path to the element in the DOM tree
 */
const sendDOMUpdate = (element: Element, path: number[]): void => {
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
 * Handles click events on the page when extension is active
 * Prevents default behavior and event propagation
 * Highlights clicked element and sends update to extension
 * 
 * @param event - Click event object
 */
const handleClick = (event: Event): void => {
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
 * Processes messages received from the extension
 * Handles various command types and returns appropriate responses
 * 
 * @param message - Message received from extension
 * @param sender - Sender information
 * @param sendResponse - Callback function to send response
 * @returns Boolean indicating if response is handled synchronously
 */
const handleMessage = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean => {
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
 * Establishes connection with the extension background script
 * Sets up disconnect listener and handles reconnection attempts
 * 
 * @returns Connected port object
 */
const connectToBackground = (): chrome.runtime.Port => {
  const port = chrome.runtime.connect({ name: 'content-script-connection' });
  
  port.onDisconnect.addListener(() => {
    contentScriptDebugLog('Port disconnected');
    
    if (chrome.runtime.lastError) {
      contentScriptErrorLog('Port error:', chrome.runtime.lastError);
    }
    
    attemptReconnect();
  });

  reconnectAttempts = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  return port;
}

/**
 * Attempts to reconnect to background script after disconnection
 * Implements exponential backoff with maximum retry limit
 */
const attemptReconnect = (): void => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    contentScriptErrorLog('Max reconnection attempts reached');
    cleanup();
    return;
  }

  reconnectAttempts++;
  contentScriptDebugLog(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  reconnectTimer = setTimeout(() => {
    try {
      connectToBackground();
      contentScriptDebugLog('Reconnection successful');
    } catch (error) {
      contentScriptErrorLog('Reconnection failed:', error);
      attemptReconnect();
    }
  }, RECONNECT_DELAY);
}

/**
 * Sets up event listeners for extension functionality
 * Initializes connection to background script
 */
const attachEventListeners = (): void => {
  contentScriptDebugLog('Attaching event listeners');

  clickHandler = handleClick;
  document.addEventListener('click', clickHandler, true);
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', cleanup);

  connectToBackground();

  contentScriptDebugLog('Event listeners attached');
}

/**
 * Handles page visibility changes
 * Triggers cleanup when page becomes hidden
 */
const handleVisibilityChange = (): void => {
  if (document.visibilityState === 'hidden') {
    cleanup();
  }
}

/**
 * Performs complete cleanup of extension state
 * Removes highlights, event listeners, and resets state variables
 */
const cleanup = (): void => {
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

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;
  } catch (error) {
    contentScriptErrorLog('Error during cleanup:', error);
  }

  contentScriptDebugLog('Cleanup complete');
}

/**
 * Initializes the content script module
 * Sets up message listener and prepares for activation
 */
const initialize = (): void => {
  contentScriptDebugLog('Initializing');
  chrome.runtime.onMessage.addListener(handleMessage);
  contentScriptDebugLog('Initialization complete - awaiting activation');
}

// Initialize the content script on load
initialize();

/**
 * Type declarations for external dependencies and messaging
 * These should be defined in a separate types file
 * 
 * @example
 * ```typescript
 * // types.ts
 * export interface DOMElement {
 *   tag: string;
 *   firstElementHTML: string;
 *   id?: string;
 *   classes?: string[];
 *   children: DOMElement[];
 *   path: number[];
 * }
 * ```
 */