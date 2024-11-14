/**
 * DOMTreeView React component module.
 * Provides a hierarchical tree visualization of DOM elements with interactive features.
 * 
 * Features:
 * - Expandable/collapsible tree nodes
 * - Element preview on hover
 * - Element selection
 * - Nested child element display
 * - Dark mode support
 * 
 * @module DOMTreeView
 * @requires react
 * @requires lucide-react
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { DOMTreeViewProps, TreeNodeProps } from '../types';

/**
 * DOMTreeView component for rendering an interactive DOM element tree
 * Provides a hierarchical view of DOM elements with expand/collapse functionality
 * 
 * @component
 * @param props - Component properties
 * @param props.element - Root DOM element to display
 * @param props.onNodeSelect - Callback function when node is selected
 * @param props.onNodePreview - Callback function for node preview
 * @param props.onClearPreview - Callback function to clear node preview
 * @returns React functional component
 * 
 * @example
 * ```tsx
 * <DOMTreeView
 *   element={domElement}
 *   onNodeSelect={(node) => handleNodeSelect(node)}
 *   onNodePreview={(node) => handleNodePreview(node)}
 *   onClearPreview={() => handleClearPreview()}
 * />
 * ```
 */
const DOMTreeView: React.FC<DOMTreeViewProps> = ({
  element,
  onNodeSelect,
  onNodePreview,
  onClearPreview
}) => {
  /**
   * TreeNode subcomponent that renders individual nodes in the tree
   * Handles node expansion state and child rendering recursively
   * 
   * @component
   * @param props - TreeNode component properties
   * @param props.node - DOM element node to render
   * @param props.level - Nesting level of the node (for indentation)
   * @returns React functional component
   */
  const TreeNode: React.FC<TreeNodeProps> = ({ node, level = 0 }) => {
    /**
     * State to track if node is expanded to show children
     */
    const [isOpen, setIsOpen] = useState(false);

    /**
     * Flag indicating if node has child elements
     */
    const hasChildren = node.children && node.children.length > 0;

    /**
     * Handles click on expand/collapse toggle button
     * Prevents event propagation to parent elements
     * 
     * @param e - Click event object
     */
    const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(!isOpen);
    };

    return (
      <div className="w-full">
        {/* Node header with expand/collapse and element info */}
        <div
          className={`flex items-center gap-1 py-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer
            ${level === 0 ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
          style={{ paddingLeft: `${level * 20}px` }}
          onClick={() => onNodeSelect(node)}
          onMouseEnter={() => onNodePreview(node)}
          onMouseLeave={onClearPreview}
        >
          <div className="flex items-center gap-2">
            {/* Expand/collapse toggle button */}
            {hasChildren && (
              <span onClick={handleToggle}>
                {isOpen ? (
                  <ChevronDown size={16} className="text-gray-600" />
                ) : (
                  <ChevronRight size={16} className="text-gray-600" />
                )}
              </span>
            )}
            {/* Element tag name */}
            <span className="text-gray-700 dark:text-gray-200">{node.tag}</span>
            {/* Element ID if present */}
            {node.id && (
              <span className="text-gray-500 dark:text-gray-400">@{node.id}</span>
            )}
          </div>
        </div>

        {/* Child nodes container */}
        {hasChildren && isOpen && (
          <div className="border-l border-gray-200 dark:border-gray-700 ml-3">
            {node.children.map((child, index) => (
              <TreeNode key={index} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
      {element.children.map((child, index) => (
        <TreeNode key={index} node={child} />
      ))}
    </div>
  );
};

/**
 * Type declarations for component props
 * @example
 * ```typescript
 * interface DOMElement {
 *   tag: string;
 *   id?: string;
 *   classes?: string[];
 *   children: DOMElement[];
 *   path: number[];
 * }
 * 
 * interface DOMTreeViewProps {
 *   element: DOMElement;
 *   onNodeSelect: (node: DOMElement) => void;
 *   onNodePreview: (node: DOMElement) => void;
 *   onClearPreview: () => void;
 * }
 * 
 * interface TreeNodeProps {
 *   node: DOMElement;
 *   level?: number;
 * }
 * ```
 */

export default DOMTreeView;