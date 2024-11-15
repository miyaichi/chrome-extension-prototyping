/**
 * Type definitions for DOM Inspector Chrome extension
 * @module types
 */

/**
 * Application settings configuration
 * Manages global settings for the extension
 * 
 * @interface Settings
 * @property {boolean} enabled - Whether the extension is currently enabled
 * 
 * @example
 * ```typescript
 * const settings: Settings = {
 *   enabled: true
 * };
 * ```
 */
export interface Settings {
  /** Indicates if the extension is currently enabled */
  enabled: boolean;

  // Add other settings properties
}

/**
 * Represents a serialized DOM element with its properties and children
 * Used for communication between content script and side panel
 * 
 * @interface DOMElement
 * @property {string} tag - HTML tag name of the element (e.g., 'div', 'span')
 * @property {string} firstElementHTML - Element's starting HTML content
 * @property {string} [id] - Element's ID attribute if present
 * @property {string[]} [classes] - Array of element's CSS classes
 * @property {DOMElement[]} children - Array of child elements
 * @property {number[]} path - Array representing the element's path in the DOM tree
 * 
 * @example
 * ```typescript
 * const element: DOMElement = {
 *   tag: 'div',
 *   firstElementHTML: '<div class="container flex">',
 *   id: 'main',
 *   classes: ['container', 'flex'],
 *   children: [],
 *   path: [0, 1, 2]
 * };
 * ```
 */
export interface DOMElement {
  /** HTML tag name of the element (e.g., 'div', 'span') */
  tag: string;

  /** Element's starting HTML content */
  firstElementHTML: string;

  /** Element's ID attribute if present */
  id?: string;

  /** Array of element's CSS classes */
  classes?: string[];

  /** Array of child elements in the DOM tree */
  children: DOMElement[];

  /**
   * Array of indices representing the element's path in the DOM tree
   * Each number represents the index of the element among its siblings
   * @example [0, 2, 1] means: first child > third child > second child
   */
  path: number[];
}

/**
 * Props for the DOMTreeView component
 */
export interface DOMTreeViewProps {
  /** Root DOM element to display */
  element: DOMElement;

  /** Callback function when a node is selected */
  onNodeSelect: (element: DOMElement) => void;

  /** Callback function when mouse enters a node */
  onNodePreview: (element: DOMElement) => void;

  /** Callback function when mouse leaves a node */
  onClearPreview: () => void;
}

/**
 * Internal tree node props interface
 */
export interface TreeNodeProps {
  /** DOM element to display */ 
  node: DOMElement;

  /** Indentation level of the node (default: 0) */
  level?: number;
}