// src/sidepanel/DomTreeView.tsx
import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';

interface DOMTreeViewProps {
  element: DOMElement;
  onNodeSelect: (element: DOMElement) => void;
  onNodePreview: (element: DOMElement) => void;
  onClearPreview: () => void;
}

const DOMTreeView: React.FC<DOMTreeViewProps> = ({
  element,
  onNodeSelect,
  onNodePreview,
  onClearPreview
}) => {
  const TreeNode: React.FC<{ node: DOMElement; level?: number }> = ({ node, level = 0 }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

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
          <span className="text-blue-600 dark:text-blue-400">{node.tag}</span>
          {node.id && (
            <span className="text-purple-600 dark:text-purple-400">#{node.id}</span>
          )}
          {node.classes && node.classes.length > 0 && (
            <span className="text-green-600 dark:text-green-400">
              .{node.classes.join('.')}
            </span>
          )}
        </div>
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