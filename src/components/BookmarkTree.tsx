import React from 'react'; // Removed useState
import { FixedSizeList, ListChildComponentProps } from 'react-window'; // Import react-window components
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
// Import the flattened node type
import { BookmarkNode, FlattenedBookmarkNode } from '../types/bookmark';

// Props for individual rendered item (still BookmarkItem)
interface BookmarkItemProps {
    node: BookmarkNode;        // The original node data
    depth: number;             // Indentation level
    isExpanded?: boolean;      // Expansion state (only for folders)
    isDuplicate: boolean;      // Duplicate status
    onDeleteNode: (id: string) => void;
    onToggleFolderExpand: (id: string) => void; // Handler from App
    style?: React.CSSProperties; // Style prop from react-window (optional here if applied in Row)
}

const BookmarkItem: React.FC<BookmarkItemProps> = ({
    node,
    depth,
    isExpanded,
    isDuplicate,
    onDeleteNode,
    onToggleFolderExpand,
    style // Receive style from Row renderer
}) => {
    const isFolder = !!node.children;
    // Expansion state is now controlled by App.tsx via isExpanded prop

    // --- DND Setup --- (Remains largely the same, applied to the inner div)
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        transform,
        isDragging
    } = useDraggable({ id: node.id, data: { type: 'bookmark', node } });

    const {
        setNodeRef: setDroppableNodeRef,
        isOver
    } = useDroppable({ id: node.id, data: { type: 'bookmark', node } });

    const setCombinedRef = (element: HTMLDivElement | null) => {
        setDraggableNodeRef(element);
        setDroppableNodeRef(element);
    };

    // Apply DND transform styles to the inner div
    const dndStyle = transform ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : undefined,
    } : {};
    // --- End DND Setup ---

    const handleToggleExpand = (event: React.MouseEvent) => {
        if (isDragging) return;
        event.stopPropagation();
        if (isFolder) {
            // Call the handler passed from App.tsx
            onToggleFolderExpand(node.id);
        }
    };

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onDeleteNode(node.id);
    };

    // Calculate indentation based on depth
    const indentStyle = { paddingLeft: `${depth * 20}px` }; // e.g., 20px per level

    const divClassName = `flex items-center p-1 rounded hover:bg-gray-100 cursor-grab ${isDuplicate ? 'border border-red-300 bg-red-50' : ''} ${isOver ? 'bg-blue-100' : ''}`;

    // Note: The outer `li` is gone. The Row component handles positioning.
    return (
        <div
            ref={setCombinedRef} // Apply DND ref here
            style={{ ...style, ...dndStyle, ...indentStyle }} // Combine styles: react-window, DND, indent
            className={divClassName}
            {...listeners}
            {...attributes}
            onClick={handleToggleExpand}
            onContextMenu={handleContextMenu}
            title={`${node.title}${node.url ? ' (' + node.url + ')' : ''} (Right-click to delete)`}
        >
            {/* Icon: Use isExpanded prop for folders */}
            <span className="mr-2 w-4 text-center flex-shrink-0">
                {isFolder ? (isExpanded ? '📂' : '📁') : '📄'}
            </span>
            {/* Title */}
            <span className="truncate flex-grow" title={node.url || node.title}>
                {node.title}
            </span>
            {/* Duplicate Badge */}
            {isDuplicate && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-red-800 bg-red-200 rounded-full flex-shrink-0" title="Duplicate URL">
                    Duplicate
                </span>
            )}
            {/* URL Link */}
            {node.url && (
                <a
                    href={node.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-500 hover:text-blue-700 hover:underline text-xs ml-2 truncate max-w-[150px] flex-shrink-0"
                    title={node.url}
                    draggable="false"
                >
                    ({node.url})
                </a>
            )}
        </div>
    );
};

// Props for the main BookmarkTree component (updated)
interface BookmarkTreeProps {
    flattenedNodes: FlattenedBookmarkNode[]; // Receive the flat list
    onDeleteNode: (id: string) => void;
    duplicateIds: Set<string>;
    onToggleFolderExpand: (id: string) => void; // Receive toggle handler
}

const ROW_HEIGHT = 36; // Adjust as needed based on your item styling (px)

// Main BookmarkTree component using react-window
const BookmarkTree: React.FC<BookmarkTreeProps> = ({
    flattenedNodes,
    onDeleteNode,
    duplicateIds,
    onToggleFolderExpand
}) => {

    // Renderer for each row in the virtualized list
    const Row: React.FC<ListChildComponentProps> = ({ index, style }) => {
        const flatNode = flattenedNodes[index];
        if (!flatNode) return null; // Should not happen if itemCount is correct

        const { node, depth, isExpanded } = flatNode;
        const isDuplicate = duplicateIds.has(node.id);

        return (
            <BookmarkItem
                key={node.id} // Key is important for React reconciliation
                node={node}
                depth={depth}
                isExpanded={isExpanded}
                isDuplicate={isDuplicate}
                onDeleteNode={onDeleteNode}
                onToggleFolderExpand={onToggleFolderExpand}
                style={style} // Pass the style from react-window for positioning
            />
        );
    };

    return (
        <div className="bookmark-tree-container mt-4 border rounded max-h-96 h-96 overflow-hidden">
            {/* Use a fixed height container for react-window */}
            {flattenedNodes.length === 0 ? (
                <p className="text-center text-gray-500 p-4">No bookmarks found or matching search.</p>
            ) : (
                <FixedSizeList
                    height={384} // Container height (e.g., 96 * 4 = 384 for Tailwind's h-96)
                    itemCount={flattenedNodes.length}
                    itemSize={ROW_HEIGHT} // Height of each row
                    width="100%" // Take full width of the container
                >
                    {Row}
                </FixedSizeList>
            )}
        </div>
    );
};

export default BookmarkTree; 