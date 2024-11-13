/**
 * A React component that renders a tree view of the DOM structure
 * @module DOMTreeView
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';

/**
 * Props for the DOMTreeView component
 */
interface DOMTreeViewProps {
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
 * A component that displays a hierarchical view of DOM elements
 * Allows for interaction with the DOM structure through an expandable tree interface
 * 
 * @param props - Component props
 * @returns React component
 */
const DOMTreeView: React.FC<DOMTreeViewProps> = ({
  element,
  onNodeSelect,
  onNodePreview,
  onClearPreview
}) => {
  /**
   * Internal component that renders a single node in the tree
   * Handles the expandable/collapsible state and rendering of child nodes
   * 
   * @param props - TreeNode props
   * @returns React component
   */
  const TreeNode: React.FC<{ 
    /** DOM element to display */ 
    node: DOMElement; 
    /** Indentation level of the node (default: 0) */
    level?: number 
  }> = ({ node, level = 0 }) => {
    // State for tracking if the node is expanded
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    /**
     * Handles the expand/collapse toggle click
     * Prevents event from bubbling up to parent handlers
     * 
     * @param e - Click event
     */
    const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(!isOpen);
    };

    return (
      <div className="w-full">
        <div
          className="flex items-center gap-1 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
          style={{ paddingLeft: `${level * 16}px` }}
          onClick={() => onNodeSelect(node)}
          onMouseEnter={() => onNodePreview(node)}
          onMouseLeave={onClearPreview}
        >
          {hasChildren && (
            <button
              onClick={handleToggle}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              {isOpen ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </button>
          )}
          {/* Tag name */}
          <span className="text-blue-600 dark:text-blue-400">{node.tag}</span>
          {/* ID if present */}
          {node.id && (
            <span className="text-purple-600 dark:text-purple-400">#{node.id}</span>
          )}
          {/* Classes if present */}
          {node.classes && node.classes.length > 0 && (
            <span className="text-green-600 dark:text-green-400">
              .{node.classes.join('.')}
            </span>
          )}
        </div>
        {/* Render children if node is expanded */}
        {hasChildren && isOpen && (
          <div>
            {node.children.map((child, index) => (
              <TreeNode key={index} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-h-[60vh] overflow-auto">
      {element.children.map((child, index) => (
        <TreeNode key={index} node={child} />
      ))}
    </div>
  );
};

export default DOMTreeView;