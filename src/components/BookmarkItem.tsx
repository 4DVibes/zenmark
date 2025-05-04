import React, { memo, useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
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
    onAddBookmark: (parentId: string | null) => void; // Added for context menu
    editingNodeId: string | null; // ID of the node currently being edited
    handleRenameNode: (nodeId: string, newTitle: string) => void; // Handler to finish renaming
}

const BookmarkItem: React.FC<BookmarkItemProps> = memo(
    ({
        node,
        depth,
        isExpanded,
        isDuplicate,
        onDeleteNode,
        onToggleFolderExpand,
        style, // Receive style from Row renderer
        onEditNode,
        onAddBookmark, // Added
        editingNodeId, // Added
        handleRenameNode, // Added
    }) => {
        const isFolder = !!node.children;

        // --- DND Setup --- 
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging
        } = useSortable({ id: node.id, data: { type: 'bookmark', node } });

        // --- Context Menu --- 
        const { show } = useContextMenu({ id: BOOKMARK_MENU_ID });

        // --- Inline Editing State ---
        const [editText, setEditText] = useState(node.title);
        const inputRef = useRef<HTMLInputElement>(null);

        // Update local edit text if the node title prop changes externally
        // while this item is *not* being edited.
        useEffect(() => {
            if (!editingNodeId) {
                setEditText(node.title);
            }
        }, [node.title, editingNodeId]);

        // Focus input when editing starts
        useEffect(() => {
            if (editingNodeId && inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }, [editingNodeId]);

        const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            setEditText(event.target.value);
        };

        const handleFinishEditing = () => {
            console.log(`[BookmarkItem] handleFinishEditing called. Current editText: "${editText}", Original title: "${node.title}"`);
            if (editText.trim() && editText.trim() !== node.title) {
                console.log(`[BookmarkItem] Calling handleRenameNode for ID: ${node.id}`);
                handleRenameNode(node.id, editText.trim());
            }
            // App state change will remove editing mode
        };

        const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
                handleFinishEditing();
            } else if (event.key === 'Escape') {
                setEditText(node.title); // Reset
                if (inputRef.current) inputRef.current.blur();
            }
        };
        // --- End Inline Editing State ---

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
                    parentId: node.parentId, // Pass parent ID
                    onDelete: () => onDeleteNode(node.id),
                    onEdit: () => onEditNode(node.id),
                    // No "Add Folder" on a bookmark, but keep AddBookmark consistent?
                    // Or maybe the context menu component itself should hide irrelevant items.
                    // For now, pass parentId null, assuming add happens in current folder (panel)
                    onAddBookmark: () => onAddBookmark(null), // Or pass node.parentId?
                }
            });
        };
        // --- End Handlers ---

        // --- Styling --- 
        const indentStyle = { paddingLeft: `${depth * 20}px` }; // 20px per level
        const dndStyle = {
            transform: CSS.Transform.toString(transform),
            transition,
            zIndex: isDragging ? 10 : undefined,
            opacity: isDragging ? 0.5 : undefined,
        };
        const divClassName = `flex items-center p-1 rounded hover:bg-gray-100 cursor-grab ${isDuplicate ? 'border border-red-300 bg-red-50' : ''}`;
        // --- End Styling ---

        // --- Return JSX --- 
        return (
            <div
                ref={setNodeRef}
                style={{ ...style, ...dndStyle, paddingLeft: `${depth * 20}px` }}
                className={divClassName}
                {...attributes}
                {...(editingNodeId ? {} : listeners)} // Conditionally apply listeners
                onContextMenu={handleContextMenu}
                title={`${node.title}${node.url ? ' (' + node.url + ')' : ''} (Right-click)`}
            >
                {/* Icon */}
                <span
                    className="mr-2 w-4 h-5 text-center flex-shrink-0 flex items-center justify-center hover:bg-gray-200 rounded"
                >
                    {isFolder ? (isExpanded ? '📂' : '📁') : '📄'}
                </span>
                {/* Title */}
                {editingNodeId === node.id ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editText}
                        onChange={handleInputChange}
                        onBlur={handleFinishEditing}
                        onKeyDown={handleKeyDown}
                        className="flex-grow px-1 border border-blue-300 rounded mr-2"
                        onClick={(e) => e.stopPropagation()} // Prevent drag start when clicking input
                    />
                ) : (
                    <span className="truncate flex-grow" title={node.url || node.title}>
                        {node.title}
                    </span>
                )}
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
    }
);
BookmarkItem.displayName = 'BookmarkItem';

// Add the default export
export default BookmarkItem; 