import React, { useMemo, memo } from 'react';
// Import SortableContext utilities
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
// Assuming we might reuse react-window here too
import { FixedSizeList, ListChildComponentProps } from 'react-window';
// Import only BookmarkNode now
import { BookmarkNode } from '../types/bookmark';
// Import the actual BookmarkItem component we used before
import BookmarkItem from './BookmarkItem';

interface BookmarkListPanelProps {
    bookmarkNodes: BookmarkNode[]; // Only bookmark nodes for the selected folder
    onDeleteNode: (nodeId: string) => void;
    onEditNode: (nodeId: string) => void;
    // Add missing props from App.tsx
    onAddBookmark: (parentId: string | null) => void; // Handler for adding bookmark (context specific?)
    editingNodeId: string | null;
    handleRenameNode: (nodeId: string, newTitle: string) => void;
    duplicateIds?: Set<string>; // Keep duplicateIds optional or handle appropriately
    // Reordering is now handled by App.tsx's handleDragEnd
}

// Data passed to each BookmarkItem row
interface BookmarkItemData {
    nodes: BookmarkNode[];
    onDeleteNode: (nodeId: string) => void;
    onEditNode: (nodeId: string) => void;
    onAddBookmark: (parentId: string | null) => void; // Pass down handler
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
    duplicateIds
}) => {
    console.log('BookmarkListPanel rendering with:', { bookmarkNodes });

    // Prepare IDs for SortableContext
    const bookmarkIds = useMemo(() => bookmarkNodes.map(node => node.id), [bookmarkNodes]);

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
        <SortableContext
            items={bookmarkIds}
            strategy={verticalListSortingStrategy}
        >
            <div className="h-full bg-white">
                {bookmarkNodes.length === 0 ? (
                    <div className="p-4 text-gray-500 flex items-center justify-center h-full">No bookmarks in this folder.</div>
                ) : (
                    <FixedSizeList
                        height={600} // Adjust or make dynamic
                        itemCount={bookmarkNodes.length}
                        itemSize={40} // Adjust based on BookmarkItem height
                        width="100%"
                        itemData={itemData}
                    >
                        {Row}
                    </FixedSizeList>
                )}
            </div>
        </SortableContext>
    );
};

export default memo(BookmarkListPanel); 