/**
 * A React component that renders a tree view of the DOM structure
 * @module DOMTreeView
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { DOMTreeViewProps, TreeNodeProps } from '../types';

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
  const TreeNode: React.FC<TreeNodeProps> = ({ node, level = 0 }) => {
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
          className={`flex items-center gap-1 py-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer
            ${level === 0 ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
          style={{ paddingLeft: `${level * 20}px` }}
          onClick={() => onNodeSelect(node)}
          onMouseEnter={() => onNodePreview(node)}
          onMouseLeave={onClearPreview}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <span onClick={handleToggle}>
                {isOpen ? (
                  <ChevronDown size={16} className="text-gray-600" />
                ) : (
                  <ChevronRight size={16} className="text-gray-600" />
                )}
              </span>
            )}
            <span className="text-gray-700 dark:text-gray-200">{node.tag}</span>
            {node.id && (
              <span className="text-gray-500 dark:text-gray-400">@{node.id}</span>
            )}
          </div>
        </div>
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

export default DOMTreeView;