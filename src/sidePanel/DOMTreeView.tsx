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
import './DOMTreeView.css';

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
      <div className="domtree-node">
        {/* Node header with expand/collapse and element info */}
        <div
          className={`domtree-node-header ${level === 0 ? 'domtree-node-header--root' : ''}`}
          style={{ paddingLeft: `${level * 20}px` }}
          onClick={() => onNodeSelect(node)}
          onMouseEnter={() => onNodePreview(node)}
          onMouseLeave={onClearPreview}
        >
          <div className="domtree-node-content">
            {/* Expand/collapse toggle button */}
            {hasChildren && (
              <span onClick={handleToggle}>
                {isOpen ? (
                  <ChevronDown size={16} className="domtree-node-toggle-icon" />
                ) : (
                  <ChevronRight size={16} className="domtree-node-toggle-icon" />
                )}
              </span>
            )}
            {/* Element tag name */}
            <span className="domtree-node-tag">{node.tag}</span>
            {/* Element ID if present */}
            {node.id && (
             <span className="domtree-node-id">@{node.id}</span>
           )}
          </div>
        </div>

        {/* Child nodes container */}
        {hasChildren && isOpen && (
          <div className="domtree-children">
            {node.children.map((child, index) => (
              <TreeNode key={index} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="domtree">
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