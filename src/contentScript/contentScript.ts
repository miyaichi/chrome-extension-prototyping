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

// Message Handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_INITIAL_DOM': {
      const rootElement = serializeDOMElement(document.documentElement);
      chrome.runtime.sendMessage({
        type: 'DOM_ELEMENT_UPDATE',
        element: rootElement
      });
      break;
    }

    case 'SELECT_ELEMENT': {
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
      const element = findElementByPath(message.path);
      if (element instanceof HTMLElement) {
        previewHighlight(element);
      }
      break;
    }
      
    case 'CLEAR_PREVIEW': {
      removePreview();
      // If there is a selected element, re-highlight it
      if (highlightedElement) {
        highlightElement(highlightedElement);
      }
      break;
    }
      
    case 'CLEAR_HIGHLIGHT':
      removeHighlight();
      removePreview();
      break;
  }
});

// Click Event Handler
document.addEventListener('click', (event) => {
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
}, true);

// Cleanup
function cleanup() {
  removeHighlight();
  removePreview();
}

// Cleanup when the page is hidden/unloaded
window.addEventListener('pagehide', cleanup);

// Cleanup when the tab is closed
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    cleanup();
  }
});