import React from 'react';
// Assuming we might reuse react-window here too
import { FixedSizeList, ListChildComponentProps } from 'react-window';
// Import only BookmarkNode now
import { BookmarkNode } from '../types/bookmark';
// Import the actual BookmarkItem component we used before
import BookmarkItem from './BookmarkItem';

interface BookmarkListPanelProps {
    bookmarkNodes: BookmarkNode[]; // Accept raw bookmark nodes (files only)
    onDeleteNode: (id: string) => void;
    onEditNode: (nodeId: string) => void;
    duplicateIds: Set<string>;
    // Remove onToggleFolderExpand
}

const ROW_HEIGHT = 36; // Keep consistent for now

const BookmarkListPanel: React.FC<BookmarkListPanelProps> = ({
    bookmarkNodes, // Use new prop name
    onDeleteNode,
    onEditNode,
    duplicateIds,
}) => {
    console.log('BookmarkListPanel rendering with:', { bookmarkNodes });

    // Renderer for each row in the virtualized list
    const Row: React.FC<ListChildComponentProps> = ({ index, style }) => {
        const node = bookmarkNodes[index]; // Get the node directly
        if (!node) return null;

        // isExpanded is always false, depth is always 0 for this panel
        const isExpanded = false;
        const depth = 0;
        const isDuplicate = duplicateIds.has(node.id);

        // Use the BookmarkItem component for rendering
        return (
            <BookmarkItem
                key={node.id} // Key is important
                node={node}
                depth={depth} // Pass 0
                isExpanded={isExpanded} // Pass false
                isDuplicate={isDuplicate}
                onDeleteNode={onDeleteNode}
                onToggleFolderExpand={() => { }} // Pass a dummy function or make prop optional
                onEditNode={onEditNode}
                style={style} // Pass the style from react-window for positioning
            // DND handlers will need to be managed here or passed down later
            />
        );
    };

    return (
        <div className="bookmark-list-panel p-2 flex-grow h-full overflow-hidden">
            <h2 className="text-lg font-semibold mb-2">Contents</h2>
            {/* Use a fixed height container for react-window */}
            <div className="list-container h-[calc(100%-40px)] border rounded overflow-y-auto">
                {bookmarkNodes.length === 0 ? (
                    <p className="text-center text-gray-500 p-4">Folder is empty or no items match search.</p>
                ) : (
                    <FixedSizeList
                        height={600} // Adjust as needed
                        itemCount={bookmarkNodes.length} // Use length of bookmarkNodes
                        itemSize={ROW_HEIGHT}
                        width="100%"
                    // Pass data needed by BookmarkItem down if necessary (alternative to closure)
                    // itemData={{ onDeleteNode, duplicateIds, onToggleFolderExpand }}
                    >
                        {Row}
                    </FixedSizeList>
                )}
            </div>
        </div>
    );
};

export default BookmarkListPanel; 