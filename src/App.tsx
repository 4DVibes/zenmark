import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BookmarkNode, FlattenedBookmarkNode } from './types/bookmark';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  closestCenter, // Use this collision detection
  // Remove DragOverlay if not used
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
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
  countNodesByType,
  addNodeToTree
} from './utils/treeUtils';
import { ROOT_FOLDER_DROP_ID } from './components/FolderTreePanel'; // Import the ID
import { useDebouncedEffect } from './hooks/useDebouncedEffect'; // Import the custom hook
import { parseBookmarkFile } from './utils/bookmarkParser';
import FolderContextMenu from './components/FolderContextMenu'; // Import context menu
import BookmarkContextMenu from './components/BookmarkContextMenu'; // Import context menu
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { debounce } from './utils/debounce'; // Import debounce utility

const SAVE_DEBOUNCE_DELAY = 500; // ms
const SEARCH_DEBOUNCE_DELAY = 300; // ms for search input

// Context Menu IDs
export const FOLDER_MENU_ID = "folder-menu";
export const BOOKMARK_MENU_ID = "bookmark-menu";

// Helper to get all duplicate IDs from the map returned by findDuplicateUrls
const getDuplicateIdSet = (tree: BookmarkNode[]): Set<string> => {
  const urlMap = findDuplicateUrls(tree);
  const duplicates = new Set<string>();
  urlMap.forEach((ids) => {
    // If a URL appears more than once, add all its IDs to the set
    if (ids.length > 1) {
      ids.forEach(id => duplicates.add(id));
    }
  });
  console.log('[getDuplicateIdSet] Calculated duplicate IDs:', duplicates);
  return duplicates;
};

/** Root component for Zenmark web app */
const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(ROOT_FOLDER_DROP_ID); // Default to root
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null); // For DND active item
  const [overId, setOverId] = useState<string | null>(null); // For DND over item
  const [nodeCounts, setNodeCounts] = useState<{ total: number, folders: number, bookmarks: number } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Single set of sensors for the main DndContext
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Smaller distance might feel better
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }) // Use sortable coordinates
  );

  // Debounced save function
  const debouncedSave = useMemo(() => debounce(saveBookmarks, SAVE_DEBOUNCE_DELAY), []);

  // --- Load Initial Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const loadedBookmarks = await loadBookmarks();
        console.log('[App] Loaded bookmarks from IndexedDB:', loadedBookmarks);
        setBookmarks(loadedBookmarks);
        // Initialize derived state after loading
        setNodeCounts(countNodesByType(loadedBookmarks));
        setDuplicateIds(getDuplicateIdSet(loadedBookmarks)); // Use helper
      } catch (err: any) {
        console.error('[App] Error loading bookmarks:', err);
        setError(`Failed to load bookmarks: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []); // Load only once on mount

  // --- Central State Update Handler (Triggers Save & Recalculates Derived State) ---
  const handleTreeUpdate = useCallback((newTree: BookmarkNode[]) => {
    console.log('[App] handleTreeUpdate called, scheduling save...');
    setBookmarks(newTree);
    // Recalculate derived state based on the new tree
    setNodeCounts(countNodesByType(newTree));
    setDuplicateIds(getDuplicateIdSet(newTree)); // Use helper to recalculate
    // Call debounced save
    debouncedSave(newTree);
  }, [debouncedSave]); // Dependency: debouncedSave function

  // --- Filtering --- Filtered tree based on search term
  const filteredTree = useMemo(() => {
    if (!searchTerm) {
      return bookmarks; // Return original tree if no search term
    }
    return filterBookmarkTree(bookmarks, searchTerm);
  }, [bookmarks, searchTerm]);

  // --- UI Event Handlers ---
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    console.log(`[App] handleUpload: Starting upload for ${file.name}`);
    try {
      // Reset state before parsing
      setBookmarks([]);
      setSelectedFolderId(null);
      setSearchTerm('');

      console.log(`[App] handleUpload: Parsing file ${file.name}...`);
      const parsedBookmarks = await parseBookmarkFile(file);
      console.log(`[App] handleUpload: Received ${parsedBookmarks.length} top-level nodes from parser.`);
      // console.log('[App] handleUpload: Sample received data:', JSON.stringify(parsedBookmarks.slice(0, 5), null, 2));

      // Calculate counts
      const counts = countNodesByType(parsedBookmarks);
      console.log(`[App] handleUpload: Calculated counts:`, counts);
      setNodeCounts(counts);

      console.log('[App] handleUpload: Attempting to set bookmarks state...');
      const newTree = parsedBookmarks;
      handleTreeUpdate(newTree);
      console.log('[App] handleUpload: Successfully set bookmarks state and calculated duplicates.');

    } catch (err: any) {
      console.error('[App] handleUpload: Error during upload/parse:', err);
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
      setBookmarks([]); // Clear bookmarks on error
      setNodeCounts(null); // Clear counts on error
    } finally {
      setLoading(false);
      console.log('[App] handleUpload: Upload process finished.');
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleSelectFolder = useCallback((folderId: string | null) => {
    console.log('[App] Selected Folder ID:', folderId);
    setSelectedFolderId(folderId);
  }, []);

  // --- Context Menu Actions --- (Add/Edit/Delete)
  const handleAddFolder = useCallback((parentId: string | null) => {
    const folderName = window.prompt("Enter the name for the new folder:", "New Folder");
    if (!folderName || folderName.trim() === "") {
      console.log("[App] Add folder cancelled.");
      return; // User cancelled or entered empty name
    }

    const newNode: BookmarkNode = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: folderName.trim(),
      children: [], // Folders always have a children array
      parentId: parentId // Store parent ID
    };

    console.log(`[App] Adding new folder "${newNode.title}" inside parent: ${parentId ?? 'root'}`);

    const newTree = insertNode(bookmarks, parentId, newNode, 'inside');
    handleTreeUpdate(newTree);
  }, [bookmarks, handleTreeUpdate]);

  const handleAddBookmark = useCallback(() => {
    if (!selectedFolderId) {
      alert("Please select a folder first to add a bookmark.");
      return;
    }

    const title = window.prompt("Enter bookmark title:");
    const url = window.prompt("Enter bookmark URL:");

    if (title && url) {
      // Basic URL validation (optional, can be enhanced)
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('javascript:')) {
        alert("Invalid URL. Please include http:// or https://");
        return;
      }

      const newBookmark: BookmarkNode = {
        id: uuidv4(), // Generate unique ID
        title,
        url,
        children: [],
        parentId: selectedFolderId, // Set parent ID
        // addDate and lastModified could be set here if needed
      };

      // Add the new bookmark to the tree
      const newTree = addNodeToTree(bookmarks, selectedFolderId, newBookmark);
      if (newTree) {
        handleTreeUpdate(newTree);
      } else {
        console.error("Failed to add bookmark: Parent folder not found.");
        alert("Error: Could not find the selected folder to add the bookmark.");
      }
    }
  }, [selectedFolderId, bookmarks, handleTreeUpdate]);

  const handleRenameNode = useCallback((nodeId: string, currentTitle: string) => {
    console.log(`[App:handleRenameNode] Received call to rename node ${nodeId} to "${currentTitle}"`); // Log entry
    const newTree = bookmarks.map(node => {
      if (node.id === nodeId) {
        // Found the node, return a new object with the updated title
        console.log(`  Found node ${nodeId}, updating title.`);
        return { ...node, title: currentTitle };
      }
      // If the node has children, recursively update them
      if (node.children) {
        const updatedChildren = node.children.map(child => {
          if (child.id === nodeId) {
            return { ...child, title: currentTitle };
          }
          return child;
        });
        // Only return a new object if children actually changed
        if (updatedChildren !== node.children) {
          return { ...node, children: updatedChildren };
        }
      }
      // No changes needed for this node or its children
      return node;
    });
    handleTreeUpdate(newTree);
    setEditingNodeId(null); // Exit editing mode
  }, [bookmarks, handleTreeUpdate]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    console.log(`Attempting to delete node: ${nodeId}`);
    const newTree = removeNodeById(bookmarks, nodeId);
    handleTreeUpdate(newTree);
    console.log(`Node ${nodeId} deleted.`);
  }, [bookmarks, handleTreeUpdate]);

  const handleRemoveDuplicates = useCallback(() => {
    if (duplicateIds.size === 0) {
      console.log("No duplicates found to remove.");
      return;
    }

    if (window.confirm(`Are you sure you want to remove all ${duplicateIds.size} identified duplicate bookmark entries? This cannot be undone.`)) {
      console.log("Removing duplicates...");
      const newTree = bookmarks.filter(node => !duplicateIds.has(node.id));
      handleTreeUpdate(newTree);
    } else {
      console.log("Duplicate removal cancelled by user.");
    }
  }, [bookmarks, duplicateIds, handleTreeUpdate]);

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

  // --- DND Handlers ---
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      console.log(`[App DragEnd] Cancelled: No target or dropped on self (Active: ${active.id}, Over: ${over?.id})`);
      return;
    }

    console.log(`[App DragEnd] === Event Start ===`);
    console.log(`  Active ID: ${active.id}, Over ID: ${over.id}`);

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData) {
      console.error('[App DragEnd] Missing active node data. Bailing out.');
      return;
    }

    const activeNode = activeData.node as BookmarkNode;
    const activeType = activeData.type as string;
    const overNode = overData?.node as BookmarkNode | undefined;
    const overType = overData?.type as string | undefined;

    console.log(`  Active Node: ${activeNode?.title} (Type: ${activeType}, Parent: ${activeNode?.parentId})`);
    console.log(`  Over Node  : ${overNode?.title} (Type: ${overType}, Parent: ${overNode?.parentId}, ID: ${over?.id})`);
    console.log(`  Selected Folder ID: ${selectedFolderId}`);

    // Scenario 1: Sorting Bookmarks within BookmarkListPanel
    if (activeType === 'bookmark' && overType === 'bookmark') {
      console.log("  Attempting Scenario 1: Sort Bookmarks");
      if (activeNode.parentId === overNode?.parentId) {
        const parentId = activeNode.parentId; // This might be undefined for root
        console.log(`    Parent IDs match: ${parentId ?? 'root'}`);

        // Allow sorting if either:
        // a) Both items have the same *defined* parentId which matches selectedFolderId
        // b) Both items have undefined parentId (root) and selectedFolderId is null
        const isRootSort = parentId === undefined && selectedFolderId === null;
        const isNestedSort = parentId !== undefined && parentId === selectedFolderId;

        if (!isRootSort && !isNestedSort) {
          console.warn(`    Sort condition not met. isRootSort=${isRootSort}, isNestedSort=${isNestedSort}. parentId=${parentId}, selectedFolderId=${selectedFolderId}. Ignoring sort.`);
          return;
        }

        console.log(`    Calling handleReorderBookmarks for parent ${parentId ?? 'ROOT'}`);
        // Pass parentId (which could be undefined -> null conversion needed?) or handle root in handler
        handleReorderBookmarks(parentId ?? null, active.id as string, over.id as string);

      } else {
        console.log(`    Parent IDs DON'T match (${activeNode.parentId} vs ${overNode?.parentId}). Ignoring.`);
      }
      return;
    }

    // Scenario 2: Sorting Folders within FolderTreePanel
    if (activeType === 'folder' && overType === 'folder') {
      console.log("  Attempting Scenario 2: Sort Folders");
      console.log(`    Calling handleReorderFolders`);
      handleReorderFolders(active.id as string, over.id as string);
      return;
    }

    // Scenario 3: Moving Bookmark to Folder
    if (activeType === 'bookmark' && overType === 'folder') {
      console.log("  Attempting Scenario 3: Move Bookmark to Folder");
      console.log(`    Moving ${active.id} onto ${over.id}`);
      const newTree = removeNodeById(bookmarks, active.id as string);
      const targetFolder = findNodeById(newTree, over.id as string);
      if (!targetFolder || !targetFolder.children) {
        console.error("      Target folder not found/invalid.");
        return;
      }
      const nodeToInsert = { ...activeNode, parentId: over.id as string };
      console.log("      Inserting node: ", nodeToInsert);
      const newTreeAfterInsert = insertNode(newTree, over.id as string, nodeToInsert, 'inside');
      handleTreeUpdate(newTreeAfterInsert);
      return;
    }

    // Scenario 4: Moving Folder (onto another Folder or Root)
    if (activeType === 'folder' && (overType === 'folder' || over.id === ROOT_FOLDER_DROP_ID)) {
      console.log("  Attempting Scenario 4: Move Folder");
      const targetParentId = over.id === ROOT_FOLDER_DROP_ID ? null : over.id as string;
      console.log(`    Target Parent ID: ${targetParentId ?? 'ROOT'}`);
      const newTree = removeNodeById(bookmarks, active.id as string);
      if (targetParentId && findNodeById([activeNode], targetParentId)) {
        console.warn("      Cannot drop folder inside itself/descendant.");
        return;
      }
      const nodeToInsert = { ...activeNode, parentId: targetParentId };
      const position = targetParentId ? 'inside' : 'root';
      console.log("      Inserting node: ", nodeToInsert, ` at position: ${position}`);
      const newTreeAfterInsert = insertNode(newTree, targetParentId, nodeToInsert, position);
      handleTreeUpdate(newTreeAfterInsert);
      return;
    }

    console.log(`[App DragEnd] === Unhandled Scenario ===`);

  }, [bookmarks, selectedFolderId, handleTreeUpdate]);

  // --- Specific Reorder Handlers (called by main handleDragEnd) ---

  const handleReorderFolders = useCallback((activeId: string, overId: string) => {
    console.log(`[App:handleReorderFolders] Reordering ${activeId} over ${overId}`);
    handleTreeUpdate(currentBookmarks => {
      // Function to find parent and perform reorder immutably
      const findAndReorder = (nodes: BookmarkNode[], parentId: string | undefined): BookmarkNode[] | null => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.id === parentId && node.children) { // Found the parent node
            const oldIndex = node.children.findIndex(child => child.id === activeId);
            const newIndex = node.children.findIndex(child => child.id === overId);
            if (oldIndex !== -1 && newIndex !== -1) {
              console.log(`  Reordering folders in parent ${parentId}: ${oldIndex} -> ${newIndex}`);
              // Return a *new* parent node with reordered children
              return [...nodes.slice(0, i),
              { ...node, children: arrayMove(node.children, oldIndex, newIndex) },
              ...nodes.slice(i + 1)];
            }
            return null; // Indices not found in this parent
          }
          // Recurse
          if (node.children) {
            const result = findAndReorder(node.children, parentId);
            if (result !== null) { // Change occurred deeper
              // Return a *new* copy of current nodes array with the modified child node
              return [...nodes.slice(0, i),
              { ...node, children: result },
              ...nodes.slice(i + 1)];
            }
          }
        }
        return null; // Parent not found at this level or below
      };

      const activeNode = findNodeById(nodes, activeId);
      const overNode = findNodeById(nodes, overId);
      if (!activeNode || !overNode || activeNode.parentId !== overNode.parentId) {
        console.error("Folder reorder failed: Nodes not found or not siblings.");
        return nodes;
      }
      const parentId = activeNode.parentId;

      if (parentId === undefined) { // Root level
        console.log("  Reordering root folders...");
        const oldIndex = nodes.findIndex(node => node.id === activeId);
        const newIndex = nodes.findIndex(node => node.id === overId);
        if (oldIndex === -1 || newIndex === -1) {
          console.error("    Root indices not found!"); return nodes;
        }
        console.log(`    Moving root index ${oldIndex} to ${newIndex}`);
        return arrayMove(nodes, oldIndex, newIndex); // arrayMove creates a new array
      } else { // Nested level
        console.log(`  Reordering nested folders under parent ${parentId}...`);
        // This recursive approach is complex for immutability, let's try mapping
        const reorderRecursiveMap = (nodes: BookmarkNode[]): BookmarkNode[] => {
          return nodes.map(node => {
            // If this is the parent, return a new node with reordered children
            if (node.id === parentId && node.children) {
              const oldIndex = node.children.findIndex(child => child.id === activeId);
              const newIndex = node.children.findIndex(child => child.id === overId);
              if (oldIndex === -1 || newIndex === -1) {
                console.error(`    Nested indices not found in parent ${parentId}!`);
                return node; // Return original node if error
              }
              console.log(`    Moving nested index ${oldIndex} to ${newIndex}`);
              return { ...node, children: arrayMove(node.children, oldIndex, newIndex) };
            }
            // If node has children, recurse and potentially get new children array
            if (node.children) {
              const newChildren = reorderRecursiveMap(node.children);
              // If children array reference changed, return a new node object
              if (newChildren !== node.children) {
                return { ...node, children: newChildren };
              }
            }
            // Otherwise return the original node reference
            return node;
          });
        }
        const newTree = reorderRecursiveMap(nodes);
        // Check if the tree reference actually changed
        return newTree !== nodes ? newTree : nodes;
      }
    });
  }, [handleTreeUpdate]);

  const handleReorderBookmarks = useCallback((parentId: string | null, activeId: string, overId: string) => {
    console.log(`[App:handleReorderBookmarks] Reordering in parent ${parentId ?? 'ROOT'}: move ${activeId} over ${overId}`);
    handleTreeUpdate(currentBookmarks => {
      // Handle Root Level Bookmarks
      if (parentId === null) {
        console.log("  Reordering root bookmarks...");
        const oldIndex = currentBookmarks.findIndex(node => node.id === activeId && !node.children);
        const newIndex = currentBookmarks.findIndex(node => node.id === overId && !node.children);
        if (oldIndex === -1 || newIndex === -1) {
          console.error(` Error finding root bookmark indices for ${activeId} or ${overId}`); return currentBookmarks;
        }
        console.log(`    Moving root index ${oldIndex} to ${newIndex}`);
        return arrayMove(currentBookmarks, oldIndex, newIndex); // arrayMove creates new array
      }

      // Handle Nested Bookmarks using map for immutability
      console.log(`  Reordering nested bookmarks under parent ${parentId}...`);
      const reorderRecursiveMap = (nodes: BookmarkNode[]): BookmarkNode[] => {
        return nodes.map(node => {
          // If this is the parent, return a new node with reordered children
          if (node.id === parentId && node.children) {
            const oldIndex = node.children.findIndex(child => child.id === activeId);
            const newIndex = node.children.findIndex(child => child.id === overId);
            if (oldIndex === -1 || newIndex === -1) {
              console.error(`    Error finding bookmark indices in parent ${parentId}`);
              return node; // Return original node if error
            }
            console.log(`    Moving nested index ${oldIndex} to ${newIndex}`);
            return { ...node, children: arrayMove(node.children, oldIndex, newIndex) };
          }
          // If node has children, recurse and potentially get new children array
          if (node.children) {
            const newChildren = reorderRecursiveMap(node.children);
            // If children array reference changed, return a new node object
            if (newChildren !== node.children) {
              return { ...node, children: newChildren };
            }
          }
          // Otherwise return the original node reference
          return node;
        });
      }
      const newTree = reorderRecursiveMap(currentBookmarks);
      return newTree !== currentBookmarks ? newTree : currentBookmarks;
    });
  }, [handleTreeUpdate]);

  // --- Derived State ---
  const selectedFolderContent = useMemo(() => {
    // ... (logic) ...
  }, [bookmarks, selectedFolderId]);

  if (loading) {
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
              onUpload={handleFileUpload}
              onClearData={handleRemoveDuplicates}
              hasData={bookmarks.length > 0}
              uploadedFileName={null}
              nodeCounts={nodeCounts}
            />
            {error && <p className="error-message">Error: {error}</p>}
            <div className="flex-grow">
              <SearchBar query={searchTerm} onQueryChange={handleSearch} />
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
                folderTree={filteredTree}
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
                matchingFolderIds={searchTerm ? filteredTree.matchingFolderIds : undefined}
                searchQuery={searchTerm}
                onDeleteNode={handleDeleteNode}
                onEditNode={handleRenameNode}
                onAddFolder={handleAddFolder}
                onAddBookmark={handleAddBookmark}
                editingNodeId={editingNodeId}
              />
            </div>

            {/* Right Panel: Bookmark List */}
            <div className="flex-grow h-full min-w-0"> {/* Takes remaining space, scrollable */}
              <div className="flex-grow overflow-auto">
                <BookmarkListPanel
                  bookmarkNodes={selectedFolderContent}
                  onDeleteNode={handleDeleteNode}
                  onEditNode={handleRenameNode}
                  onAddBookmark={handleAddBookmark}
                  editingNodeId={editingNodeId}
                />
              </div>
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

// Simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  // ... existing code ...
}