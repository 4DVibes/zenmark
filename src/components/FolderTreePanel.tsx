import React, { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useDroppable, useDraggable } from '@dnd-kit/core'; // Import useDroppable and useDraggable
import { CSS } from '@dnd-kit/utilities';
import { useContextMenu } from 'react-contexify';
import { FOLDER_MENU_ID } from '../App'; // Import the menu ID
import { BookmarkNode, FlattenedBookmarkNode } from '../types/bookmark';
import { flattenBookmarkTree } from '../utils/treeUtils'; // Import the flattening utility

// Define ID for the root drop target
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

// Internal component to render a single folder row
interface FolderRowProps {
    data: {
        items: FlattenedBookmarkNode[];
        selectedFolderId: string | null;
        onSelectFolder: (folderId: string | null) => void;
        expandedIds: Set<string>;
        toggleExpand: (folderId: string) => void;
        searchQuery?: string;
        matchingFolderIds?: Set<string>;
        // Context Menu Handlers passed down
        onEditNode: (nodeId: string) => void;
        onDeleteNode: (nodeId: string) => void;
        onAddFolder: (parentId: string | null) => void;
        onAddBookmark: (parentId: string | null) => void;
        editingNodeId: string | null;
        handleRenameNode: (nodeId: string, newTitle: string) => void;
    };
    index: number;
    style: React.CSSProperties;
}

// Memoized Row Component for react-window
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

    // Draggable setup
    const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform, isDragging } = useDraggable({
        id: bookmarkNode.id,
        data: { node: bookmarkNode, type: 'folder' },
    });

    // Droppable setup (for dropping items *onto* this folder)
    const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
        id: bookmarkNode.id,
        data: { accepts: ['bookmark', 'folder'] }
    });

    const dragStyle = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 10, // Ensure dragged item is on top
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grabbing',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)', // Add shadow while dragging
        backgroundColor: 'lightblue', // Highlight while dragging
    } : {};

    const combinedRef = (instance: HTMLDivElement | null) => {
        setDraggableNodeRef(instance);
        setDroppableNodeRef(instance);
    };

    // Combine base style, indentation, and drag style
    const finalStyle = {
        ...style, // Base style from react-window
        paddingLeft: `${node.depth * 16 + 8}px`, // Indentation
        ...dragStyle // Drag styles override or add to base/indentation
    };

    // Skip rendering the root node placeholder
    if (node.id === ROOT_FOLDER_DROP_ID) {
        return null;
    }

    const indentStyle = { paddingLeft: `${node.depth * INDENT_WIDTH}px` };

    // Dim the folder if searching and it's not a match
    const rowClassName = `flex items-center p-1 cursor-pointer rounded text-sm truncate 
        ${isSelected ? 'bg-blue-100 font-bold' : 'hover:bg-gray-100'}
        ${isDimmed ? 'text-gray-400 opacity-70' : ''}
    `;

    return (
        <div ref={combinedRef} style={finalStyle} {...(isEditing ? {} : listeners)} {...attributes} onContextMenu={handleContextMenu}>
            <div
                className={`flex items-center h-full px-2 py-1 border-b border-gray-200 ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'} ${isDimmed ? 'opacity-50' : ''} ${isOver ? 'bg-green-100 border-green-400 border-2' : ''}`}
            >
                {/* Folder Icon */}
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
    handleRenameNode
}) => {
    const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(new Set());
    const isSearching = !!searchQuery && searchQuery.length > 0;

    // *** Early exit if no folders exist ***
    if (!folderTree || folderTree.length === 0) {
        return (
            <div className="folder-tree-panel h-full overflow-y-auto border rounded bg-gray-50 p-4 text-center text-gray-500">
                <h2 className="text-lg font-semibold p-2 flex-shrink-0 border-b mb-2">Folders</h2>
                No bookmarks loaded.
            </div>
        );
    }

    const handleToggleExpand = useCallback((folderId: string) => {
        setLocalExpandedIds(prevIds => {
            const newIds = new Set(prevIds);
            if (newIds.has(folderId)) {
                newIds.delete(folderId);
            } else {
                newIds.add(folderId);
            }
            console.log(`[FolderTreePanel] handleToggleExpand - Updated localExpandedIds:`, newIds);
            return newIds;
        });
    }, []);

    // Flatten the folder tree based on local expansion state
    const flattenedFolderNodes = useMemo(() => {
        const flatList = flattenBookmarkTree(folderTree, localExpandedIds);
        console.log('[FolderTreePanel] Calculated flattenedFolderNodes:', flatList);
        return flatList;
    }, [folderTree, localExpandedIds]);

    // Create a key that changes when the number of nodes changes
    // This helps force react-window to recalculate when items are added/removed
    const listKey = flattenedFolderNodes.length;

    // Setup droppable for the root element
    const { setNodeRef: setRootDropRef, isOver: isOverRoot } = useDroppable({
        id: ROOT_FOLDER_DROP_ID,
    });

    // Filter out the root droppable area for the list itself
    const displayNodes = useMemo(() => {
        console.log('[FolderTreePanel] Recalculating flattenedFolderNodes...');
        // Add "(All Bookmarks)" item manually
        const allBookmarksNode: FlattenedBookmarkNode = {
            id: ROOT_FOLDER_DROP_ID, // Use the special ID
            node: { id: ROOT_FOLDER_DROP_ID, title: '(All Bookmarks)', children: [] }, // Mock node
            depth: 0,
            isExpanded: undefined
        };
        const flattened = flattenBookmarkTree(folderTree, localExpandedIds);
        console.log(`[FolderTreePanel] Calculated flattenedFolderNodes:`, flattened);
        return [allBookmarksNode, ...flattened];
    }, [folderTree, localExpandedIds]);

    // --- Context Menu for background --- 
    const { show: showRootMenu } = useContextMenu({ id: FOLDER_MENU_ID });

    const handleBackgroundContextMenu = (event: React.MouseEvent) => {
        // Check if the click is directly on the panel background, not on a row
        if (event.target === event.currentTarget) {
            event.preventDefault();
            showRootMenu({
                event,
                props: {
                    nodeId: null, // Indicate root/background click
                    onEditNode,
                    onDeleteNode,
                    onAddFolder,
                    onAddBookmark,
                }
            });
        }
    };

    // Prepare data object for FixedSizeList items
    const itemData = useMemo<RowData>(() => ({
        nodes: displayNodes,
        selectedFolderId,
        onSelectFolder,
        localExpandedIds,
        toggleExpand: handleToggleExpand,
        matchingFolderIds,
        onDeleteNode,
        onEditNode,
        onAddFolder,
        onAddBookmark,
        editingNodeId,
        handleRenameNode
    }), [
        displayNodes,
        selectedFolderId,
        onSelectFolder,
        localExpandedIds,
        handleToggleExpand,
        matchingFolderIds,
        onDeleteNode,
        onEditNode,
        onAddFolder,
        onAddBookmark,
        editingNodeId,
        handleRenameNode
    ]);

    // Renderer for react-window list
    const RowRenderer: React.FC<ListChildComponentProps> = ({ index, style }) => {
        const flatNode = displayNodes[index];
        if (!flatNode) return null;

        // Determine if the folder matches the search criteria (if searching)
        const isMatch = !isSearching || (matchingFolderIds?.has(flatNode.id) ?? true);

        return (
            <FolderRow
                data={itemData}
                index={index}
                style={style}
            />
        );
    };

    return (
        <div className="folder-tree-panel h-full overflow-y-auto border rounded bg-gray-50" onContextMenu={handleBackgroundContextMenu}>
            <h2 className="text-lg font-semibold p-2 flex-shrink-0 border-b">Folders</h2>
            {/* Root Selection / Drop Target */}
            <div
                ref={setRootDropRef} // Attach droppable ref
                onClick={() => onSelectFolder(null)}
                className={`p-2 cursor-pointer text-sm flex-shrink-0 border-b 
                  ${selectedFolderId === null ? 'bg-blue-100 font-bold' : 'hover:bg-gray-100'}
                  ${isOverRoot ? 'outline outline-2 outline-blue-500' : ''} // Add visual drop indicator
                `}
            >
                (All Bookmarks)
            </div>
            {/* Virtualized Folder List */}
            <div className="flex-grow overflow-y-auto">
                {displayNodes.length === 0 && !isSearching && (
                    <p className="p-2 text-gray-500 text-sm">No folders found.</p>
                )}
                {displayNodes.length === 0 && isSearching && (
                    <p className="p-2 text-gray-500 text-sm">No folders match search.</p>
                )}
                {displayNodes.length > 0 && (
                    <FixedSizeList
                        key={listKey} // Add key prop based on item count
                        height={600}
                        itemCount={displayNodes.length}
                        itemSize={ROW_HEIGHT}
                        width="100%"
                    >
                        {RowRenderer}
                    </FixedSizeList>
                )}
            </div>
        </div>
    );
};

export default FolderTreePanel; 