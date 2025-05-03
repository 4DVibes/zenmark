import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BookmarkNode, FlattenedBookmarkNode } from './types/bookmark';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import FileUpload from './components/FileUpload';
import SearchBar from './components/SearchBar';
import FolderTreePanel from './components/FolderTreePanel';
import BookmarkListPanel from './components/BookmarkListPanel';
import { loadBookmarks, saveBookmarks, clearBookmarks } from './utils/bookmarkStorage';
import {
  findNodeById,
  removeNodeById,
  insertNode,
  filterBookmarkTree,
  findDuplicateUrls,
  generateBookmarkHtml,
  flattenBookmarkTree,
  extractFolderTree,
  getNodeChildren,
  countNodesByType
} from './utils/treeUtils';
import { ROOT_FOLDER_DROP_ID } from './components/FolderTreePanel'; // Import the ID
import { useDebouncedEffect } from './hooks/useDebouncedEffect'; // Import the custom hook
import { parseBookmarkFile } from './utils/bookmarkParser';
import FolderContextMenu from './components/FolderContextMenu'; // Import context menu
import BookmarkContextMenu from './components/BookmarkContextMenu'; // Import context menu

const SAVE_DEBOUNCE_DELAY = 500; // ms
const SEARCH_DEBOUNCE_DELAY = 300; // ms for search input

// Context Menu IDs
export const FOLDER_MENU_ID = "folder-menu";
export const BOOKMARK_MENU_ID = "bookmark-menu";

/** Root component for Zenmark web app */
const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState(''); // Instant search query for input field
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(''); // Debounced query for filtering
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  // State to track the currently selected folder ID (null for root)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [nodeCounts, setNodeCounts] = useState<{ total: number, folders: number, bookmarks: number } | null>(null);

  // --- DND Setup ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !active.data.current) {
      console.log('Drag cancelled or invalid drop target.');
      return;
    }

    const activeNode = active.data.current.node as BookmarkNode;
    const overId = over.id as string;

    console.log(`Drag End: Item ${activeNode.id} (${activeNode.title}) dropped over ID: ${overId}`);

    if (active.id === overId) {
      console.log("Dropped on self, no change.");
      return;
    }

    setBookmarks((currentBookmarks) => {
      const nodeToMove = activeNode;
      const treeWithoutNode = removeNodeById(currentBookmarks, nodeToMove.id);

      let position: 'inside' | 'after' | 'root' = 'after';
      let finalTargetId: string | null = null;

      if (overId === ROOT_FOLDER_DROP_ID) {
        console.log("Dropped onto root target.");
        position = 'root';
        finalTargetId = null;
      } else {
        finalTargetId = overId;
        const targetNode = findNodeById(treeWithoutNode, finalTargetId);

        if (targetNode?.children) {
          position = 'inside';
        } else {
          position = 'after';
        }

        if (position === 'inside' && targetNode && findNodeById([nodeToMove], targetNode.id)) {
          console.warn("Cannot drop a folder inside itself or its descendants.");
          return currentBookmarks;
        }
      }

      console.log(`Inserting node ${nodeToMove.id} with position: ${position}, targetId: ${finalTargetId}`);
      const newTree = insertNode(treeWithoutNode, finalTargetId, nodeToMove, position);
      return newTree;
    });
  };
  // --- End DND Setup ---

  // --- Context Menu Handlers ---
  const handleEditNode = useCallback((nodeId: string) => {
    console.log(`[App] Placeholder: Edit node ${nodeId}`);
    // TODO: Implement inline editing or modal
  }, []);

  const handleAddFolder = useCallback((parentId: string | null) => {
    console.log(`[App] Placeholder: Add folder inside ${parentId ?? 'root'}`);
    // TODO: Implement folder creation logic
  }, []);

  const handleAddBookmark = useCallback((parentId: string | null) => {
    console.log(`[App] Placeholder: Add bookmark inside ${parentId ?? 'root'}`);
    // TODO: Implement bookmark creation logic
  }, []);

  /** Handles deleting a node */
  const handleDeleteNode = useCallback((nodeId: string) => {
    console.log(`Attempting to delete node: ${nodeId}`);
    setBookmarks((currentBookmarks) => {
      const nodeToDelete = findNodeById(currentBookmarks, nodeId);
      if (!nodeToDelete) {
        console.warn(`Node ${nodeId} not found for deletion.`);
        return currentBookmarks; // Node not found, return original state
      }

      // Optional: Add extra confirmation for deleting non-empty folders
      if (nodeToDelete.children && nodeToDelete.children.length > 0) {
        if (!window.confirm(`Are you sure you want to delete the folder "${nodeToDelete.title}" and all its contents?`)) {
          return currentBookmarks; // User cancelled
        }
      } else {
        if (!window.confirm(`Are you sure you want to delete "${nodeToDelete.title}"?`)) {
          return currentBookmarks; // User cancelled
        }
      }

      // Remove the node using the utility function
      const newTree = removeNodeById(currentBookmarks, nodeId);
      console.log(`Node ${nodeId} deleted.`);
      return newTree;
    });
  }, []); // useCallback with empty dependency array as it only uses setBookmarks

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("Attempting to load bookmarks from IndexedDB...");
        const loadedBookmarks = await loadBookmarks();
        // --- DEBUG LOG --- 
        console.log('[App] Loaded bookmarks state:', JSON.stringify(loadedBookmarks, null, 2)); // Log loaded data
        // --- END DEBUG LOG ---
        setBookmarks(loadedBookmarks);
        console.log("Bookmarks loaded:", loadedBookmarks.length);
      } catch (error) {
        console.error("Failed to load bookmarks from IndexedDB:", error);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };
    loadData();
  }, []);

  // Debounced effect for saving bookmarks
  useDebouncedEffect(() => {
    // Avoid saving during initial load or while loading is still true
    if (isInitialLoad || isLoading) {
      return;
    }

    const saveData = async () => {
      try {
        console.log('[Debounced Save] Attempting to save bookmarks to IndexedDB...');
        await saveBookmarks(bookmarks);
        console.log('[Debounced Save] Bookmarks saved successfully.');
      } catch (error) {
        console.error('[Debounced Save] Failed to save bookmarks:', error);
      }
    };

    saveData();

    // No cleanup needed for this specific effect
  },
    [bookmarks, isInitialLoad, isLoading], // Dependencies: Effect runs when these change
    SAVE_DEBOUNCE_DELAY // Debounce delay
  );

  const handleUpload = useCallback(async (file: File) => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setUploadedFileName(file.name); // Store filename
    setNodeCounts(null); // Reset counts
    console.log(`[App] handleUpload: Starting upload for ${file.name}`);
    try {
      // Reset state before parsing
      setBookmarks([]);
      setSelectedFolderId(null);
      setSearchQuery('');
      setDebouncedSearchQuery('');

      console.log(`[App] handleUpload: Parsing file ${file.name}...`);
      const parsedBookmarks = await parseBookmarkFile(file);
      console.log(`[App] handleUpload: Received ${parsedBookmarks.length} top-level nodes from parser.`);
      // console.log('[App] handleUpload: Sample received data:', JSON.stringify(parsedBookmarks.slice(0, 5), null, 2));

      // Calculate counts
      const counts = countNodesByType(parsedBookmarks);
      console.log(`[App] handleUpload: Calculated counts:`, counts);
      setNodeCounts(counts);

      console.log('[App] handleUpload: Attempting to set bookmarks state...');
      setBookmarks(parsedBookmarks);
      // Calculate duplicates after setting bookmarks
      setDuplicateIds(findDuplicateUrls(parsedBookmarks));
      console.log('[App] handleUpload: Successfully set bookmarks state and calculated duplicates.');

    } catch (err: any) {
      console.error('[App] handleUpload: Error during upload/parse:', err);
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
      setBookmarks([]); // Clear bookmarks on error
      setUploadedFileName(null); // Clear filename on error
      setNodeCounts(null); // Clear counts on error
    } finally {
      setIsLoading(false);
      console.log('[App] handleUpload: Upload process finished.');
    }
  }, []);

  const handleExport = () => {
    if (bookmarks.length === 0) {
      console.warn('No bookmarks to export.');
      return;
    }

    console.log('Exporting bookmarks...');
    try {
      // Generate the HTML content
      const htmlContent = generateBookmarkHtml(bookmarks);

      // Create a Blob
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

      // Create a temporary link element
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'zenmark_bookmarks.html'; // Set the desired filename

      // Append to the DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Optional: Revoke the object URL to free up memory
      URL.revokeObjectURL(link.href);

      console.log('Bookmarks exported successfully.');
    } catch (error) {
      console.error('Failed to export bookmarks:', error);
      // Optional: Show an error message to the user
      alert('Failed to export bookmarks. Check console for details.');
    }
  };

  // Calculate duplicate IDs whenever bookmarks change
  useEffect(() => {
    if (!isLoading) {
      const newDuplicateIds = findDuplicateUrls(bookmarks);
      setDuplicateIds(newDuplicateIds);
    }
  }, [bookmarks, isLoading]);

  // Debounced effect to update the actual filter query
  useDebouncedEffect(() => {
    console.log(`[Debounced Search] Updating filter query to: "${searchQuery}"`);
    setDebouncedSearchQuery(searchQuery);
  },
    [searchQuery], // Depends only on the instant query
    SEARCH_DEBOUNCE_DELAY
  );

  // Memoize the search results based on the *debounced* query
  const searchResults = useMemo(() => {
    console.log(`[App] Recalculating search results for query: "${debouncedSearchQuery}"...`);
    // Use debouncedSearchQuery for filtering
    return filterBookmarkTree(bookmarks, debouncedSearchQuery);
  }, [bookmarks, debouncedSearchQuery]); // Depends on debounced query

  // Memoize the folder-only tree structure for the left panel
  const folderTree = useMemo(() => {
    console.log('[App] Recalculating folderTree...');
    return extractFolderTree(bookmarks); // Use the full tree for structure
  }, [bookmarks]);

  // Get the nodes to display in the right panel based on selection and search
  const rightPanelNodes = useMemo(() => {
    console.log('[App] Recalculating rightPanelNodes...');
    console.log(`  [App] rightPanelNodes - selectedFolderId: ${selectedFolderId}`);
    console.log(`  [App] rightPanelNodes - Input tree node count (original bookmarks): ${bookmarks.length}`);
    // --- Explicitly check findNodeById --- \n    const parentNode = selectedFolderId ? findNodeById(bookmarks, selectedFolderId) : null; \n    // console.log(`  [App] rightPanelNodes - parentNode found by findNodeById:`, parentNode ? { id: parentNode.id, title: parentNode.title, hasChildrenProp: parentNode.hasOwnProperty('children'), childrenCount: parentNode.children?.length } : null); // Remove this log\n\n    // Get children directly from the found node (if any)\n    const children = parentNode?.children || (selectedFolderId === null ? bookmarks : []); // Handle root case here too\n    // console.log(`  [App] rightPanelNodes - Children array obtained:`, children); // Remove this log\n\n    // Filter to keep only bookmark items\n    const bookmarkItemsOnly = children.filter(node => node.url !== undefined && node.url !== null);\n    console.log(`[App] Bookmark items for right panel (FolderID: ${selectedFolderId}):`, bookmarkItemsOnly); // Keep this final log\n    return bookmarkItemsOnly;\n  }, [bookmarks, selectedFolderId]);

    // Get children directly from the found node (if any)
    const children = selectedFolderId ? findNodeById(bookmarks, selectedFolderId)?.children || [] : bookmarks;
    console.log(`  [App] rightPanelNodes - Children array obtained:`, children);

    // Filter to keep only bookmark items
    const bookmarkItemsOnly = children.filter(node => node.url !== undefined && node.url !== null);
    console.log(`[App] Bookmark items for right panel (FolderID: ${selectedFolderId}):`, bookmarkItemsOnly);
    return bookmarkItemsOnly;
  }, [bookmarks, selectedFolderId]);

  /** Handles toggling the expansion state of a folder */
  const handleToggleFolderExpand = useCallback((folderId: string) => {
    setExpandedFolderIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(folderId)) {
        newIds.delete(folderId);
      } else {
        newIds.add(folderId);
      }
      console.log('[App] Updated expandedFolderIds:', newIds); // Log state change
      return newIds;
    });
  }, []);

  /** Handles removing all identified duplicate nodes */
  const handleRemoveDuplicates = useCallback(() => {
    if (duplicateIds.size === 0) {
      console.log("No duplicates found to remove.");
      return;
    }

    if (window.confirm(`Are you sure you want to remove all ${duplicateIds.size} identified duplicate bookmark entries? This cannot be undone.`)) {
      console.log("Removing duplicates...");
      setBookmarks((currentBookmarks) => {
        // Recursively filter the tree, removing nodes whose IDs are in the duplicate set
        const removeDuplicatesRecursive = (nodes: BookmarkNode[]): BookmarkNode[] => {
          return nodes
            .filter(node => !duplicateIds.has(node.id)) // Remove node if its ID is in the set
            .map(node => {
              if (node.children) {
                // Recursively process children
                const newChildren = removeDuplicatesRecursive(node.children);
                // Return node with potentially updated children
                return { ...node, children: newChildren };
              }
              // If node has no children or wasn't removed, return as is
              return node;
            });
        };

        const newTree = removeDuplicatesRecursive(currentBookmarks);
        console.log("Duplicates removed.");
        return newTree;
      });
    } else {
      console.log("Duplicate removal cancelled by user.");
    }
  }, [duplicateIds]); // Dependency: duplicateIds set

  /** Handles selecting a folder in the tree */
  const handleSelectFolder = useCallback((folderId: string | null) => {
    console.log(`[App] Selecting folder ID: ${folderId}`);
    setSelectedFolderId(folderId);
    // Optional: Reset search query when changing folders?
    // setSearchQuery(''); 
  }, []);

  const handleClearData = useCallback(() => {
    setBookmarks([]);
    setSelectedFolderId(null);
    setExpandedFolderIds(new Set());
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setUploadedFileName(null);
    setNodeCounts(null);
    clearBookmarks()
      .then(() => console.log('[App] Cleared bookmarks from IndexedDB.'))
      .catch((err: any) => console.error('[App] Error clearing IndexedDB:', err));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg font-semibold">Loading bookmarks...</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-6xl w-full h-[80vh] flex flex-col">
          <h1 className="text-2xl font-bold text-center mb-4 flex-shrink-0">Zenmark</h1>

          {/* Top Controls Row */}
          <div className="mb-4 flex space-x-4 flex-shrink-0">
            <FileUpload
              onUpload={handleUpload}
              onClearData={handleClearData}
              hasData={bookmarks.length > 0}
              uploadedFileName={uploadedFileName}
              nodeCounts={nodeCounts}
            />
            {error && <p className="error-message">Error: {error}</p>}
            <div className="flex-grow">
              <SearchBar query={searchQuery} onQueryChange={setSearchQuery} />
            </div>
            {/* Add Export/Duplicate buttons here? */}
            <div className="flex items-center space-x-2">
              {duplicateIds.size > 0 && (
                <button /* Remove Duplicates Button */
                  onClick={handleRemoveDuplicates}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm"
                  title={`Remove all ${duplicateIds.size} duplicate bookmark entries`}
                >
                  Remove Duplicates ({duplicateIds.size})
                </button>
              )}
              <button /* Export Button */
                onClick={handleExport}
                disabled={bookmarks.length === 0}
                className={`bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm ${bookmarks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Export Bookmarks
              </button>
            </div>
          </div>

          {/* Main Content Area (Two Panels) */}
          <div className="flex flex-grow min-h-0"> {/* Flex row, allow panels to grow and scroll */}
            {/* Left Panel: Folder Tree */}
            <div className="w-1/3 max-w-xs flex-shrink-0 h-full"> {/* Fixed width, scrollable */}
              <FolderTreePanel
                folderTree={folderTree}
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
                matchingFolderIds={debouncedSearchQuery ? searchResults.matchingFolderIds : undefined}
                searchQuery={debouncedSearchQuery}
                onDeleteNode={handleDeleteNode}
                onEditNode={handleEditNode}
                onAddFolder={handleAddFolder}
                onAddBookmark={handleAddBookmark}
              />
            </div>

            {/* Right Panel: Bookmark List */}
            <div className="flex-grow h-full min-w-0"> {/* Takes remaining space, scrollable */}
              <BookmarkListPanel
                bookmarkNodes={rightPanelNodes} // Pass the filtered bookmark nodes directly
                onDeleteNode={handleDeleteNode}
                onEditNode={handleEditNode}
                duplicateIds={duplicateIds}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Context Menus (Rendered outside the main layout flow) */}
      <FolderContextMenu />
      <BookmarkContextMenu />
    </DndContext>
  );
};

export default App;