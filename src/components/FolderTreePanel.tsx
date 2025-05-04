import React, { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useContextMenu } from 'react-contexify';
import { FOLDER_MENU_ID } from '../App';
import { BookmarkNode, FlattenedBookmarkNode } from '../types/bookmark';
import { flattenBookmarkTree } from '../utils/treeUtils';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';

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

    // Use useSortable hook from HEAD
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isOver
    } = useSortable({ id: bookmarkNode.id, data: { node: bookmarkNode, type: 'folder' } });

    const dragStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    };

    const finalStyle = {
        ...style,
        paddingLeft: `${node.depth * INDENT_WIDTH + 8}px`,
        ...dragStyle
    };

    // Dim the folder if searching and it's not a match
    const rowClassName = `flex items-center h-full px-2 py-1 border-b border-gray-200 
        ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}
        ${isDimmed ? 'opacity-50' : ''}
        ${isOver ? 'bg-blue-200 border-blue-400 border-2' : ''}
    `;

    return (
        <div ref={setNodeRef} style={finalStyle} {...attributes} {...(isEditing ? {} : listeners)} onContextMenu={handleContextMenu}>
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
        console.log("[FolderTreePanel] Recalculating flattenedNodes...");
        const nodes = flattenBookmarkTree(folderTree, localExpandedIds);
        console.log("[FolderTreePanel] Flattened node IDs: ", nodes.map(n => n.id));
        return nodes;
    }, [folderTree, localExpandedIds]);

    // Fix: Get IDs for SortableContext
    const folderIds = useMemo(() => flattenedNodes.map(item => item.id), [flattenedNodes]);

    // Expand/collapse logic
    const toggleExpand = useCallback((folderId: string) => {
        setLocalExpandedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    }, []);

    // Auto-expand matching folders during search
    useEffect(() => {
        if (isSearching && matchingFolderIds) {
            setLocalExpandedIds(new Set(matchingFolderIds));
        } else if (!isSearching) {
            // Optional: Collapse all when search is cleared?
            // setLocalExpandedIds(new Set());
        }
    }, [isSearching, matchingFolderIds]);

    // Prepare itemData for FixedSizeList
    const itemData = useMemo<RowData>(() => ({
        nodes: flattenedNodes,
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
    }), [
        flattenedNodes,
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
    ]);

    // Fix: Add itemKey function for FixedSizeList
    const getItemKey = useCallback((index: number, data: RowData) => {
        // Use the unique node ID as the key
        return data.nodes[index].id;
    }, []); // Empty dependency array, function itself doesn't depend on state

    // Add context menu for the background of the panel
    const { show: showBackgroundMenu } = useContextMenu({ id: FOLDER_MENU_ID });
    const handleBackgroundContextMenu = (event: React.MouseEvent) => {
        // Ensure click is on the panel background, not an item
        if (event.target === event.currentTarget) {
            event.preventDefault();
            console.log("[FolderTreePanel] Context menu for background.");
            showBackgroundMenu({
                event,
                props: {
                    nodeId: null, // Indicate root context
                    parentId: null,
                    onAddFolder: () => onAddFolder(null),
                    // Disable other actions for root
                    onDelete: null,
                    onEdit: null,
                    onAddBookmark: null,
                }
            });
        }
    };

    // Root droppable area (for adding items to root and context menu)
    const { setNodeRef: setRootDroppableRef, isOver: isOverRoot } = useDroppable({
        id: ROOT_FOLDER_DROP_ID,
        data: { accepts: ['folder'] } // Root only accepts folders for now
    });

    return (
        <div
            ref={setRootDroppableRef}
            className={`h-full overflow-y-auto bg-gray-50 border border-gray-300 rounded flex flex-col ${isOverRoot ? 'bg-blue-50' : ''}`}
            onContextMenu={handleBackgroundContextMenu}
        >
            <div className="p-2 border-b border-gray-300 text-sm font-medium bg-gray-100">
                Folders
            </div>
            {/* Fix: Wrap FixedSizeList in SortableContext */}
            <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
                <div className="flex-grow p-1"> {/* Padding for list items */}
                    {folderTree.length === 0 ? (
                        <div className="p-4 text-gray-500 text-center text-sm">No folders found.</div>
                    ) : (
                        <FixedSizeList
                            height={600} // Adjust height or make dynamic
                            itemCount={flattenedNodes.length}
                            itemSize={ROW_HEIGHT}
                            width="100%"
                            itemData={itemData}
                            itemKey={getItemKey}
                            className="focus:outline-none" // Remove focus ring from list itself
                        >
                            {FolderRow}
                        </FixedSizeList>
                    )}
                </div>
            </SortableContext>
            {/* Drop indicator for root (optional) */}
            {isOverRoot && (
                <div className="p-2 text-center text-xs text-blue-600 border-t border-dashed border-blue-400">
                    Drop here to move to root
                </div>
            )}
        </div>
    );
};

export default memo(FolderTreePanel); 