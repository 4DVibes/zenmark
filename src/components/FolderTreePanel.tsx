import React, { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
// Remove DND Kit core and sortable imports specific to inner context
// import {
//     DndContext,
//     closestCenter,
//     KeyboardSensor,
//     PointerSensor,
//     useSensor,
//     useSensors,
//     DragEndEvent
// } from '@dnd-kit/core';
// import {
//     arrayMove,
//     SortableContext,
//     sortableKeyboardCoordinates,
//     verticalListSortingStrategy,
//     useSortable // Import useSortable
// } from '@dnd-kit/sortable';
// Re-add useDraggable/useDroppable for external control
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useContextMenu } from 'react-contexify';
import { FOLDER_MENU_ID } from '../App'; // Import the menu ID
import { BookmarkNode, FlattenedBookmarkNode } from '../types/bookmark';
import { flattenBookmarkTree } from '../utils/treeUtils'; // Import the flattening utility

// Define ID for the root drop target (Still useful for context menu/adding)
export const ROOT_FOLDER_DROP_ID = '__ROOT__';

interface FolderTreePanelProps {
    folderTree: BookmarkNode[];        // Tree containing only folders
    selectedFolderId: string | null;
    onSelectFolder: (folderId: string | null) => void;
    matchingFolderIds?: Set<string>; // IDs of folders containing matches (when searching)
    searchQuery?: string; // Pass search query to know if filtering is active
    // Context Menu Handlers
    onEditNode: (nodeId: string) => void;
    onDeleteNode: (nodeId: string) => void;
    onAddFolder: (parentId: string | null) => void;
    onAddBookmark: (parentId: string | null) => void;
    editingNodeId: string | null; // ID of the node currently being edited
    handleRenameNode: (nodeId: string, newTitle: string) => void; // Handler to finish renaming
    // Remove onReorderFolders as it's handled by App.tsx now
    // onReorderFolders: (activeId: string, overId: string) => void; 
}

const ROW_HEIGHT = 32; // Height for folder rows
const INDENT_WIDTH = 20; // Pixels per indent level

// Data passed to each row item via FixedSizeList's itemData
interface RowData {
    nodes: FlattenedBookmarkNode[];
    selectedFolderId: string | null;
    onSelectFolder: (folderId: string | null) => void;
    localExpandedIds: Set<string>;
    toggleExpand: (folderId: string) => void;
    matchingFolderIds?: Set<string>;
    onDeleteNode: (nodeId: string) => void;
    onEditNode: (nodeId: string) => void;
    onAddFolder: (parentId: string | null) => void;
    onAddBookmark: (parentId: string | null) => void;
    editingNodeId: string | null;
    handleRenameNode: (nodeId: string, newTitle: string) => void;
}

// Internal component to render a single folder row (Reverting to useDraggable/useDroppable)
const FolderRow = memo(({ index, style, data }: ListChildComponentProps<RowData>) => {
    const {
        nodes,
        selectedFolderId,
        onSelectFolder,
        localExpandedIds,
        toggleExpand,
        matchingFolderIds,
        onDeleteNode,
        onEditNode,
        onAddFolder,
        onAddBookmark,
        editingNodeId,
        handleRenameNode
    } = data;

    const node = nodes[index];
    const bookmarkNode = node.node;

    const isSelected = selectedFolderId === bookmarkNode.id;
    const isExpanded = localExpandedIds.has(bookmarkNode.id);
    const isDimmed = matchingFolderIds && !matchingFolderIds.has(bookmarkNode.id);
    const isEditing = editingNodeId === bookmarkNode.id;

    const { show } = useContextMenu({ id: FOLDER_MENU_ID });

    // --- Inline Editing State ---
    const [editText, setEditText] = useState(bookmarkNode.title);
    const inputRef = useRef<HTMLInputElement>(null);

    // Update local edit text if the node title prop changes externally
    // while this item is *not* being edited.
    useEffect(() => {
        if (!isEditing) {
            setEditText(bookmarkNode.title);
        }
    }, [bookmarkNode.title, isEditing]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select(); // Select text for easy replacement
        }
    }, [isEditing]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEditText(event.target.value);
    };

    const handleFinishEditing = () => {
        console.log(`[FolderRow] handleFinishEditing called. Current editText: "${editText}", Original title: "${bookmarkNode.title}"`); // Log
        if (editText.trim() && editText.trim() !== bookmarkNode.title) {
            console.log(`[FolderRow] Calling handleRenameNode for ID: ${bookmarkNode.id}`); // Log
            handleRenameNode(bookmarkNode.id, editText.trim());
        }
        // Exiting edit mode happens in App.tsx by setting editingNodeId to null
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleFinishEditing();
        } else if (event.key === 'Escape') {
            setEditText(bookmarkNode.title); // Reset text on escape
            if (inputRef.current) inputRef.current.blur(); // Trigger blur to exit
        }
    };
    // --- End Inline Editing State ---

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        console.log(`[FolderRow] Context menu for: ${bookmarkNode.title} (${bookmarkNode.id})`);
        show({
            event,
            props: {
                nodeId: bookmarkNode.id,
                parentId: bookmarkNode.parentId,
                onDelete: () => onDeleteNode(bookmarkNode.id),
                onEdit: () => onEditNode(bookmarkNode.id),
                onAddFolder: () => onAddFolder(bookmarkNode.id),
                onAddBookmark: () => onAddBookmark(bookmarkNode.id),
            }
        });
    };

    // Combine click handlers for selection and expansion
    const handleRowClick = () => {
        console.log(`[FolderRow] Clicked: ${bookmarkNode.title}, ID: ${bookmarkNode.id}`);
        onSelectFolder(bookmarkNode.id);
        toggleExpand(bookmarkNode.id);
    };

    // --- DND Setup (Using useDraggable/useDroppable controlled by App.tsx) ---
    const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform, isDragging } = useDraggable({
        id: bookmarkNode.id,
        data: { node: bookmarkNode, type: 'folder' },
    });
    const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
        id: bookmarkNode.id,
        data: { node: bookmarkNode, type: 'folder', accepts: ['bookmark', 'folder'] } // Specify accepts here
    });

    const dragStyle = transform ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    } : {};

    const combinedRef = (instance: HTMLDivElement | null) => {
        setDraggableNodeRef(instance);
        setDroppableNodeRef(instance);
    };
    // --- End DND Setup ---

    // Combine base style, indentation, and drag style
    const finalStyle = {
        ...style, // Base style from react-window
        paddingLeft: `${node.depth * INDENT_WIDTH + 8}px`, // Indentation
        ...dragStyle // Apply drag styles
    };

    // Dim the folder if searching and it's not a match
    const rowClassName = `flex items-center h-full px-2 py-1 border-b border-gray-200 
        ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}
        ${isDimmed ? 'opacity-50' : ''}
        ${isOver ? 'bg-green-100 border-green-400 border-2' : ''} // Style for drop target
    `;

    return (
        // Apply combined ref, style, listeners, attributes
        <div ref={combinedRef} style={finalStyle} {...(isEditing ? {} : listeners)} {...attributes} onContextMenu={handleContextMenu}>
            <div className={rowClassName}>
                {/* Folder Icon & Click Handler */}
                <span className="mr-1 w-5 h-5 flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={handleRowClick}>
                    {isExpanded ? '📂' : '📁'}
                </span>
                {/* Title or Input */}
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editText}
                        onChange={handleInputChange}
                        onBlur={handleFinishEditing}
                        onKeyDown={handleKeyDown}
                        className="flex-grow px-1 border border-blue-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="flex-grow truncate cursor-pointer" onClick={handleRowClick}>
                        {bookmarkNode.title}
                    </span>
                )}
            </div>
        </div>
    );
});
FolderRow.displayName = 'FolderRow'; // Add display name

// Main Panel Component
const FolderTreePanel: React.FC<FolderTreePanelProps> = ({
    folderTree,
    selectedFolderId,
    onSelectFolder,
    matchingFolderIds,
    searchQuery,
    onEditNode,
    onDeleteNode,
    onAddFolder,
    onAddBookmark,
    editingNodeId,
    handleRenameNode,
    // Removed onReorderFolders
}) => {
    const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(new Set());
    const isSearching = !!searchQuery && searchQuery.length > 0;

    // Flatten the tree for rendering in the list
    const flattenedNodes = useMemo(() => {
        console.log("[FolderTreePanel] Flattening tree...");
        // Pass localExpandedIds to the function as it seems to expect it
        return flattenBookmarkTree(folderTree, localExpandedIds);
    }, [folderTree, localExpandedIds]);

    // Removed flattenedNodeIds, sensors, handleDragEnd for sorting

    // Memoized itemData for FixedSizeList
    const itemData = useMemo<RowData>(() => ({
        nodes: flattenedNodes,
        selectedFolderId,
        onSelectFolder,
        localExpandedIds,
        toggleExpand: (id) => setLocalExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        }),
        matchingFolderIds,
        onEditNode,
        onDeleteNode,
        onAddFolder,
        onAddBookmark,
        editingNodeId,
        handleRenameNode
    }), [flattenedNodes, selectedFolderId, onSelectFolder, localExpandedIds, matchingFolderIds, onEditNode, onDeleteNode, onAddFolder, onAddBookmark, editingNodeId, handleRenameNode]);

    // *** Early exit if no folders exist ***
    if (!folderTree || folderTree.length === 0) {
        return (
            <div className="folder-tree-panel h-full overflow-y-auto border rounded bg-gray-50 p-4 text-center text-gray-500">
                <h2 className="text-lg font-semibold p-2 flex-shrink-0 border-b mb-2">Folders</h2>
                No bookmarks loaded.
            </div>
        );
    }

    // Row renderer function for FixedSizeList
    const RowRenderer: React.FC<ListChildComponentProps<RowData>> = ({ index, style }) => (
        <FolderRow index={index} style={style} data={itemData} />
    );

    return (
        <div className="folder-tree-panel h-full flex flex-col border rounded bg-gray-50 overflow-hidden">
            <h2 className="text-lg font-semibold p-2 flex-shrink-0 border-b">Folders</h2>
            {/* Remove DND Context Wrappers */}
            <div className="flex-grow overflow-y-auto">
                <FixedSizeList
                    height={600} // Adjust height as needed or make dynamic
                    itemCount={flattenedNodes.length}
                    itemSize={ROW_HEIGHT}
                    width="100%"
                    itemData={itemData}
                    className="focus:outline-none" // Remove focus ring from list itself
                >
                    {RowRenderer}
                </FixedSizeList>
            </div>
        </div>
    );
};

export default memo(FolderTreePanel); 