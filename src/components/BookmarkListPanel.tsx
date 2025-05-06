import React, { useMemo, memo } from 'react';
// Fix: Remove duplicate imports
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
// Assuming we might reuse react-window here too
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer'; // Import AutoSizer
// Remove duplicate imports
// import {
//     SortableContext,
//     verticalListSortingStrategy,
// } from '@dnd-kit/sortable';
import { BookmarkNode } from '../types/bookmark';
import BookmarkItem from './BookmarkItem';
// import SearchBar from './SearchBar'; // Remove SearchBar import

interface BookmarkListPanelProps {
    bookmarkNodes: BookmarkNode[]; // Only bookmark nodes for the selected folder
    onDeleteNode: (nodeId: string) => void;
    onEditNode: (nodeId: string) => void;
    // Add missing props from App.tsx
    onAddBookmark: () => void; // No longer needs parentId here
    editingNodeId: string | null;
    handleRenameNode: (nodeId: string, newTitle: string) => void;
    duplicateIds?: Set<string>; // Keep duplicateIds optional or handle appropriately
    // Reordering is now handled by App.tsx's handleDragEnd
    // searchQuery: string; // Remove prop
    // onQueryChange: (query: string) => void; // Remove prop
}

// Data passed to each BookmarkItem row
interface BookmarkItemData {
    nodes: BookmarkNode[];
    onDeleteNode: (nodeId: string) => void;
    onEditNode: (nodeId: string) => void;
    onAddBookmark: () => void; // Pass down handler
    editingNodeId: string | null; // Pass down editing state
    handleRenameNode: (nodeId: string, newTitle: string) => void; // Pass down rename handler
    duplicateIds?: Set<string>;
}

const BookmarkListPanel: React.FC<BookmarkListPanelProps> = ({
    bookmarkNodes,
    onDeleteNode,
    onEditNode,
    onAddBookmark, // Receive handler
    editingNodeId, // Receive state
    handleRenameNode, // Receive handler
    duplicateIds,
    // searchQuery, // Remove prop
    // onQueryChange // Remove prop
}) => {
    // console.log('BookmarkListPanel rendering with:', { bookmarkNodes, searchQuery });
    console.log('BookmarkListPanel rendering with:', { bookmarkNodes });

    // Prepare IDs for SortableContext
    const bookmarkIds = useMemo(() => (bookmarkNodes || []).map(node => node.id), [bookmarkNodes]);

    const itemData = useMemo<BookmarkItemData>(() => ({
        nodes: bookmarkNodes,
        onDeleteNode,
        onEditNode,
        onAddBookmark,
        editingNodeId,
        handleRenameNode,
        duplicateIds
    }), [bookmarkNodes, onDeleteNode, onEditNode, onAddBookmark, editingNodeId, handleRenameNode, duplicateIds]);

    if (!bookmarkNodes || bookmarkNodes.length === 0) {
        return <div className="p-4 text-gray-500">Select a folder or upload bookmarks.</div>;
    }

    // Renderer for FixedSizeList
    const Row = memo(({ index, style, data }: ListChildComponentProps<BookmarkItemData>) => (
        <BookmarkItem
            style={style} // Pass style for positioning
            node={data.nodes[index]}
            depth={0}
            isExpanded={false}
            onDeleteNode={data.onDeleteNode}
            onEditNode={data.onEditNode}
            onAddBookmark={data.onAddBookmark} // Pass down handler
            editingNodeId={data.editingNodeId} // Pass down state
            handleRenameNode={data.handleRenameNode} // Pass down handler
            isDuplicate={!!data.duplicateIds?.has(data.nodes[index].id)}
        />
    ));
    Row.displayName = 'BookmarkRow'; // Add display name for DevTools

    // Wrap the list with SortableContext, but NOT DndContext
    return (
        <div className="h-full bg-white flex flex-col border border-gray-300 rounded">
            <div className="p-2 border-b border-gray-300 bg-gray-100 text-left flex justify-between items-center flex-shrink-0">
                <span className="text-base font-semibold text-gray-800">Bookmarks</span>
                <button
                    onClick={onAddBookmark}
                    className="px-2 py-1 text-xs border border-gray-400 text-gray-700 hover:bg-gray-100 rounded flex-shrink-0"
                    title="Add New Bookmark"
                >
                    + Add Bookmark
                </button>
            </div>
            <div className="flex-grow overflow-auto p-1"> {/* Added p-1 for slight spacing around the list */}
                <AutoSizer>
                    {({ height, width }) => (
                        <SortableContext
                            items={bookmarkIds}
                            strategy={verticalListSortingStrategy}
                        >
                            {(!bookmarkNodes || bookmarkNodes.length === 0) ? (
                                <div className="p-4 text-gray-500 flex items-center justify-center h-full">
                                    No bookmarks in this folder.
                                </div>
                            ) : (
                                <FixedSizeList
                                    height={height} // Use dynamic height
                                    itemCount={bookmarkNodes.length}
                                    itemSize={40} // Adjust based on BookmarkItem height
                                    width={width} // Use dynamic width
                                    itemData={itemData}
                                    className="list-container"
                                >
                                    {Row}
                                </FixedSizeList>
                            )}
                        </SortableContext>
                    )}
                </AutoSizer>
            </div>
        </div>
    );
};

export default memo(BookmarkListPanel); 