import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { BookmarkNode } from '../types/bookmark';
import { useContextMenu } from 'react-contexify';
import { BOOKMARK_MENU_ID } from '../App'; // Import the menu ID

// Props for individual rendered item
interface BookmarkItemProps {
    node: BookmarkNode;        // The original node data
    depth: number;             // Indentation level
    isExpanded?: boolean;      // Expansion state (only for folders)
    isDuplicate: boolean;      // Duplicate status
    onDeleteNode: (id: string) => void;
    onToggleFolderExpand?: (id: string) => void; // Optional toggle handler
    style?: React.CSSProperties; // Style prop from react-window 
    onEditNode: (id: string) => void; // Add edit handler
}

const BookmarkItem: React.FC<BookmarkItemProps> = ({
    node,
    depth,
    isExpanded,
    isDuplicate,
    onDeleteNode,
    onToggleFolderExpand,
    style, // Receive style from Row renderer
    onEditNode
}) => {
    const isFolder = !!node.children;

    // --- DND Setup --- 
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

    const dndStyle = transform ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : undefined,
    } : {};
    // --- End DND Setup ---

    // --- Context Menu --- 
    const { show } = useContextMenu({ id: BOOKMARK_MENU_ID });

    // --- Handlers ---
    const handleToggleExpand = (event: React.MouseEvent) => {
        if (isDragging) return;
        event.stopPropagation();
        if (isFolder) {
            onToggleFolderExpand?.(node.id); // Use optional chaining
        }
    };

    const handleContextMenu = (event: React.MouseEvent) => {
        console.log(`[BookmarkItem] handleContextMenu triggered for node: ${node.id}`);
        event.preventDefault();
        show({
            event,
            props: {
                nodeId: node.id,
                onEditNode,
                onDeleteNode,
            }
        });
    };
    // --- End Handlers ---

    // --- Styling --- 
    const indentStyle = { paddingLeft: `${depth * 20}px` }; // 20px per level
    const divClassName = `flex items-center p-1 rounded hover:bg-gray-100 cursor-grab ${isDuplicate ? 'border border-red-300 bg-red-50' : ''} ${isOver ? 'bg-blue-100' : ''}`;
    // --- End Styling ---

    // --- Return JSX --- 
    return (
        <div
            ref={setCombinedRef}
            style={{ ...style, ...dndStyle, ...indentStyle }} // Combine styles
            className={divClassName}
            {...listeners}
            {...attributes}
            onClick={handleToggleExpand} // Toggle handled here (if optional prop provided)
            onContextMenu={handleContextMenu}
            title={`${node.title}${node.url ? ' (' + node.url + ')' : ''} (Right-click to delete)`}
        >
            {/* Icon */}
            <span
                onClick={isFolder ? handleToggleExpand : undefined} // Allow icon click to toggle too for folders
                className="mr-2 w-4 h-5 text-center flex-shrink-0 flex items-center justify-center hover:bg-gray-200 rounded"
            >
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
                    onClick={(e) => e.stopPropagation()} // Prevent link click triggering row click
                    className="text-blue-500 hover:text-blue-700 hover:underline text-xs ml-2 truncate max-w-[150px] flex-shrink-0"
                    title={node.url}
                    draggable="false"
                >
                    ({node.url})
                </a>
            )}
        </div>
    );
    // --- End Return JSX --- 
};

// Add the default export
export default BookmarkItem; 