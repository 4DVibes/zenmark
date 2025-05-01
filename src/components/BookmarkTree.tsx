import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities'; // Import CSS for transform styles
import { BookmarkNode } from '../types/bookmark';

// Helper component to render individual bookmark nodes recursively
interface BookmarkItemProps {
    node: BookmarkNode;
    onDeleteNode: (id: string) => void; // Add delete handler prop
}

const BookmarkItem: React.FC<BookmarkItemProps> = ({ node, onDeleteNode }) => {
    const isFolder = node.children !== undefined;
    const [isExpanded, setIsExpanded] = useState(false);

    // --- DND Setup for Item ---
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef, // Ref for the draggable element
        transform,
        isDragging // State to know if item is being dragged
    } = useDraggable({
        id: node.id, // Unique ID for this draggable item
        data: { type: 'bookmark', node }, // Pass node data for onDragEnd logic
    });

    const {
        setNodeRef: setDroppableNodeRef, // Ref for the droppable element
        isOver // State to know if a draggable is over this droppable
    } = useDroppable({
        id: node.id, // Unique ID for this droppable area
        data: { type: 'bookmark', node }, // Pass node data for onDragEnd logic
    });

    // Combine refs for the element that is both draggable and droppable
    const setNodeRef = (element: HTMLElement | null) => {
        setDraggableNodeRef(element);
        setDroppableNodeRef(element);
    };

    // Apply transform styles during drag
    const style = transform ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 10 : undefined, // Bring dragged item to front
        opacity: isDragging ? 0.5 : undefined, // Make dragged item semi-transparent
    } : undefined;

    // --- End DND Setup ---

    const handleToggleExpand = (event: React.MouseEvent) => {
        // Prevent toggle when dragging starts on the item itself
        if (isDragging) return;
        event.stopPropagation(); // Prevent parent toggle if nested
        if (isFolder) {
            setIsExpanded(!isExpanded);
        }
    };

    // Handle right-click context menu for deletion
    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault(); // Prevent default browser context menu
        event.stopPropagation(); // Prevent context menu on parent items

        // Confirmation is now handled in App.tsx, just call the handler
        onDeleteNode(node.id);
    };

    return (
        <li
            ref={setNodeRef} // Attach combined ref here
            style={style} // Apply dragging styles
            className={`my-1 list-none ${isOver ? 'bg-blue-100' : ''}`} // Highlight when droppable is over
            onContextMenu={handleContextMenu} // Add context menu handler here
        >
            <div
                className="flex items-center p-1 rounded hover:bg-gray-100 cursor-grab" // Change cursor to grab
                {...listeners} // Spread listeners for drag start
                {...attributes} // Spread attributes for accessibility
                onClick={handleToggleExpand} // Use the updated handler
                title={`${node.title} (Right-click to delete)`} // Update title hint
            >
                <span className="mr-2 w-4 text-center"> {/* Fixed width for icon */}
                    {isFolder ? (isExpanded ? '📂' : '📁') : '📄'}
                </span>
                <span className="truncate flex-grow" title={node.url || node.title}>
                    {node.title}
                </span>
                {node.url && (
                    <a
                        href={node.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent link click from toggling expand or starting drag
                            // Optionally allow default link behavior: window.open(node.url, '_blank'); 
                        }}
                        className="text-blue-500 hover:text-blue-700 hover:underline text-xs ml-2 truncate max-w-[150px]"
                        title={node.url}
                        draggable="false" // Prevent native anchor drag behavior
                    >
                        ({node.url})
                    </a>
                )}
            </div>
            {isFolder && isExpanded && node.children && node.children.length > 0 && (
                <ul className="pl-6 border-l border-gray-300 ml-[18px]"> {/* Adjusted margin-left slightly */}
                    {node.children.map((child) => (
                        <BookmarkItem key={child.id} node={child} onDeleteNode={onDeleteNode} />
                    ))}
                </ul>
            )}
        </li>
    );
};

// Main BookmarkTree component
interface BookmarkTreeProps {
    bookmarks: BookmarkNode[];
    onDeleteNode: (id: string) => void; // Add delete handler prop
}

const BookmarkTree: React.FC<BookmarkTreeProps> = ({ bookmarks, onDeleteNode }) => {
    return (
        <div className="bookmark-tree-container mt-4 border rounded p-4 max-h-96 overflow-y-auto">
            {bookmarks.length === 0 ? (
                <p className="text-center text-gray-500">No bookmarks found.</p>
            ) : (
                <ul>
                    {bookmarks.map((node) => (
                        <BookmarkItem key={node.id} node={node} onDeleteNode={onDeleteNode} />
                    ))}
                </ul>
            )}
        </div>
    );
};

export default BookmarkTree; 