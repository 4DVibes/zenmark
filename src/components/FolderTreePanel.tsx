import React, { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
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
export const ALL_BOOKMARKS_ITEM_ID = '__ALL_BOOKMARKS__'; // ID for the new item

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

const ROW_HEIGHT = 40; // Increased height
const INDENT_WIDTH = 20; // Pixels per indent level

// Data passed to each row item via FixedSizeList's itemData
interface RowData {
    nodes: FlattenedBookmarkNode[];
    selectedFolderId: string | null;
    onSelectFolder: (folderId: string | null) => void;
    localExpandedIds: Set<string>;
    toggleExpand: (folderId: string) => void;
    matchingFolderIds?: Set<string>;
    searchQuery?: string; // Add searchQuery to RowData
    onDeleteNode: (nodeId: string) => void;
    onEditNode: (nodeId: string) => void;
    onAddFolder: (parentId: string | null) => void;
    onAddBookmark: (parentId: string | null) => void;
    editingNodeId: string | null;
    handleRenameNode: (nodeId: string, newTitle: string) => void;
    isAllBookmarksRow?: boolean; // Indicate if it's the special row
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
        searchQuery,
        onDeleteNode,
        onEditNode,
        onAddFolder,
        onAddBookmark,
        editingNodeId,
        handleRenameNode
    } = data;

    const node = nodes[index];
    const bookmarkNode = node.node;
    const isAllBookmarksItem = node.id === ALL_BOOKMARKS_ITEM_ID;

    const isSelected = isAllBookmarksItem
        ? selectedFolderId === ROOT_FOLDER_DROP_ID
        : selectedFolderId === bookmarkNode.id;
    const isExpanded = localExpandedIds.has(bookmarkNode.id);

    // Revised isDimmed logic
    const isSearchingActive = searchQuery && searchQuery.length > 0;
    const isDimmed = !isAllBookmarksItem &&
        isSearchingActive &&
        matchingFolderIds &&
        !matchingFolderIds.has(bookmarkNode.id);

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
    } = useSortable({
        id: node.id, // Use node.id which is unique
        data: { node: bookmarkNode, type: isAllBookmarksItem ? 'all_bookmarks_item' : 'folder' },
        disabled: isAllBookmarksItem, // Disable sorting for "All Bookmarks"
    });

    const dragStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    };

    const finalStyle = {
        ...style,
        paddingLeft: isAllBookmarksItem ? '8px' : `${node.depth * INDENT_WIDTH + 8}px`,
        ...dragStyle
    };

    // Dim the folder if searching and it's not a match
    const rowClassName = `flex items-center h-full px-2 py-1 border-b border-gray-200 
        ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}
        ${isDimmed ? 'opacity-50' : ''}
        ${isOver ? 'bg-blue-200 border-blue-400 border-2' : ''}
    `;

    // Conditional logic for rendering "All Bookmarks" vs. regular folders will go here later
    // For now, just logging to confirm it receives the item
    if (isAllBookmarksItem) {
        console.log("[FolderRow] Rendering ALL_BOOKMARKS_ITEM_ID");
    }

    return (
        <div ref={setNodeRef} style={finalStyle} {...attributes} {...(isEditing || isAllBookmarksItem ? {} : listeners)} onContextMenu={isAllBookmarksItem ? undefined : handleContextMenu}>
            <div className={rowClassName}>
                {/* Folder Icon & Click Handler - Increased Size */}
                <span className="mr-2 w-6 h-6 flex items-center justify-center flex-shrink-0 cursor-pointer text-lg" onClick={isAllBookmarksItem ? () => onSelectFolder(ROOT_FOLDER_DROP_ID) : handleRowClick}>
                    {isAllBookmarksItem ? '🏠' : (isExpanded ? '📂' : '📁')}
                </span>
                {/* Title or Input */}
                {isEditing && !isAllBookmarksItem ? (
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
                    <span className={`flex-grow truncate cursor-pointer text-left text-sm text-gray-800 ${isAllBookmarksItem ? 'font-medium' : ''}`} onClick={isAllBookmarksItem ? () => onSelectFolder(ROOT_FOLDER_DROP_ID) : handleRowClick}>
                        {isAllBookmarksItem ? "All Bookmarks" : bookmarkNode.title}
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
    const flattenedNodesAndAllBookmarks = useMemo(() => {
        const allBookmarksPseudoNode: FlattenedBookmarkNode = {
            id: ALL_BOOKMARKS_ITEM_ID,
            node: { // This is a pseudo BookmarkNode structure
                id: ALL_BOOKMARKS_ITEM_ID,
                title: 'All Bookmarks',
                parentId: null,
                children: undefined, // Important: signifies it's not a folder for some utils
                // dateAdded and other BookmarkNode fields can be omitted if not strictly needed by FolderRow for this item
            },
            depth: 0,
            isExpanded: undefined, // Not expandable
        };
        const actualFlattenedFolders = flattenBookmarkTree(folderTree, localExpandedIds);
        return [allBookmarksPseudoNode, ...actualFlattenedFolders];
    }, [folderTree, localExpandedIds]);

    // Fix: Get IDs for SortableContext
    const folderIdsForSortableContext = useMemo(() =>
        flattenedNodesAndAllBookmarks
            .filter(item => item.id !== ALL_BOOKMARKS_ITEM_ID)
            .map(item => item.id)
        , [flattenedNodesAndAllBookmarks]);

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
        nodes: flattenedNodesAndAllBookmarks,
        selectedFolderId,
        onSelectFolder,
        localExpandedIds,
        toggleExpand,
        matchingFolderIds,
        searchQuery,
        onDeleteNode,
        onEditNode,
        onAddFolder,
        onAddBookmark,
        editingNodeId,
        handleRenameNode
    }), [
        flattenedNodesAndAllBookmarks,
        selectedFolderId,
        onSelectFolder,
        localExpandedIds,
        toggleExpand,
        matchingFolderIds,
        searchQuery,
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
            className={`h-full overflow-hidden bg-gray-50 border border-gray-300 rounded flex flex-col ${isOverRoot ? 'bg-blue-50' : ''}`}
            onContextMenu={handleBackgroundContextMenu}
        >
            <div className="p-2 border-b border-gray-300 bg-gray-100 text-left flex justify-between items-center flex-shrink-0">
                <span className="text-base font-semibold text-gray-800">Folders</span>
                <button
                    onClick={() => onAddFolder(null)} // Add to root
                    className="px-2 py-1 text-xs border border-gray-400 text-gray-700 hover:bg-gray-100 rounded flex-shrink-0"
                    title="Add New Folder"
                >
                    + Add Folder
                </button>
            </div>
            <div className="flex-grow p-1 overflow-hidden">
                <AutoSizer>
                    {({ height, width }) => (
                        <SortableContext items={folderIdsForSortableContext} strategy={verticalListSortingStrategy}>
                            {folderTree.length === 0 ? (
                                <div className="p-4 text-gray-500 text-center text-sm">No folders found.</div>
                            ) : (
                                <FixedSizeList
                                    height={height}
                                    itemCount={flattenedNodesAndAllBookmarks.length}
                                    itemSize={ROW_HEIGHT}
                                    width={width}
                                    itemData={itemData}
                                    itemKey={getItemKey}
                                    className="focus:outline-none list-container"
                                >
                                    {FolderRow}
                                </FixedSizeList>
                            )}
                        </SortableContext>
                    )}
                </AutoSizer>
            </div>
            {isOverRoot && (
                <div className="p-2 text-center text-xs text-blue-600 border-t border-dashed border-blue-400 flex-shrink-0">
                    Drop here to move to root
                </div>
            )}
        </div>
    );
};

export default memo(FolderTreePanel); 