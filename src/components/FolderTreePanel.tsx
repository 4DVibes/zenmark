import React, { useState, useMemo, useCallback, memo } from 'react';
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
}

const ROW_HEIGHT = 32; // Height for folder rows
const INDENT_WIDTH = 20; // Pixels per indent level

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
    };
    index: number;
    style: React.CSSProperties;
}

// Memoized Row Component for react-window
const FolderRow: React.FC<FolderRowProps> = memo(({ data, index, style }) => {
    const { items, selectedFolderId, onSelectFolder, expandedIds, toggleExpand, searchQuery, matchingFolderIds, onEditNode, onDeleteNode, onAddFolder, onAddBookmark } = data;
    const flatNode = items[index];
    const { node, depth, isExpanded } = flatNode;
    const isSelected = node.id === selectedFolderId;
    const isSearching = !!searchQuery;
    const isMatch = !isSearching || (matchingFolderIds?.has(node.id));

    // --- Context Menu --- 
    const { show } = useContextMenu({ id: FOLDER_MENU_ID });

    const handleContextMenu = (event: React.MouseEvent) => {
        console.log(`[FolderRow] handleContextMenu triggered for node: ${node.id}`);
        event.preventDefault();
        show({
            event,
            props: {
                nodeId: node.id,
                onEditNode,
                onDeleteNode,
                onAddFolder,
                onAddBookmark,
            }
        });
    };

    // --- Drag and Drop --- 
    const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform, isDragging } = useDraggable({
        id: node.id,
        data: { node } // Pass necessary data for drop handling
    });

    // Combine react-window style with dnd-kit transform
    const combinedStyle = {
        ...style,
        transform: CSS.Transform.toString(transform),
    };

    // Skip rendering the root node placeholder
    if (node.id === ROOT_FOLDER_DROP_ID) {
        return null;
    }

    const indentStyle = { paddingLeft: `${depth * INDENT_WIDTH}px` };

    // Combined handler for selection AND toggle
    const handleRowClick = () => {
        onSelectFolder(node.id);
        toggleExpand(node.id);
    };

    // Dim the folder if searching and it's not a match
    const rowClassName = `flex items-center p-1 cursor-pointer rounded text-sm truncate 
        ${isSelected ? 'bg-blue-100 font-bold' : 'hover:bg-gray-100'}
        ${isSearching && !isMatch ? 'text-gray-400 opacity-70' : ''}
    `;

    return (
        <div
            ref={setDraggableNodeRef} // Use combined ref for draggable
            style={combinedStyle} // Apply combined styles (react-window + dnd)
            className={`folder-row flex items-center py-1 px-2 cursor-pointer rounded hover:bg-gray-200 ${isSelected ? 'bg-blue-200' : ''} ${isDragging ? 'opacity-50' : ''} ${!isMatch && isSearching ? 'opacity-40' : ''}`}
            onClick={handleRowClick} // Combined select and toggle
            onContextMenu={handleContextMenu} // Attach context menu handler
        >
            <span style={indentStyle} className="flex items-center flex-grow">
                <span
                    className="w-5 h-5 mr-1 flex-shrink-0 flex items-center justify-center"
                >
                    {isExpanded ? '📂' : '📁'}
                </span>
                <span className="truncate" title={node.title}>
                    {node.title}
                </span>
            </span>
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
    onAddBookmark
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

    // Renderer for react-window list
    const RowRenderer: React.FC<ListChildComponentProps> = ({ index, style }) => {
        const flatNode = displayNodes[index];
        if (!flatNode) return null;

        // Determine if the folder matches the search criteria (if searching)
        const isMatch = !isSearching || (matchingFolderIds?.has(flatNode.id) ?? true);

        return (
            <FolderRow
                data={{
                    items: displayNodes,
                    selectedFolderId,
                    onSelectFolder,
                    expandedIds: localExpandedIds,
                    toggleExpand: handleToggleExpand,
                    searchQuery,
                    matchingFolderIds,
                    onEditNode,
                    onDeleteNode,
                    onAddFolder,
                    onAddBookmark,
                }}
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