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
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null); // State to track inline editing

  // Single set of sensors for the main DndContext
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Smaller distance might feel better
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }) // Use sortable coordinates
  );

  // --- Central Drag End Handler --- 
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
      setBookmarks((currentBookmarks) => {
        console.log("    Inside setBookmarks for Move Bookmark -> Folder");
        const treeWithoutNode = removeNodeById(currentBookmarks, active.id as string);
        const targetFolder = findNodeById(treeWithoutNode, over.id as string);
        if (!targetFolder || !targetFolder.children) {
          console.error("      Target folder not found/invalid."); return currentBookmarks;
        }
        const nodeToInsert = { ...activeNode, parentId: over.id as string };
        console.log("      Inserting node: ", nodeToInsert);
        return insertNode(treeWithoutNode, over.id as string, nodeToInsert, 'inside');
      });
      return;
    }

    // Scenario 4: Moving Folder (onto another Folder or Root)
    if (activeType === 'folder' && (overType === 'folder' || over.id === ROOT_FOLDER_DROP_ID)) {
      console.log("  Attempting Scenario 4: Move Folder");
      const targetParentId = over.id === ROOT_FOLDER_DROP_ID ? null : over.id as string;
      console.log(`    Target Parent ID: ${targetParentId ?? 'ROOT'}`);
      setBookmarks((currentBookmarks) => {
        console.log("    Inside setBookmarks for Move Folder");
        const treeWithoutNode = removeNodeById(currentBookmarks, active.id as string);
        if (targetParentId && findNodeById([activeNode], targetParentId)) {
          console.warn("      Cannot drop folder inside itself/descendant.");
          return currentBookmarks;
        }
        const nodeToInsert = { ...activeNode, parentId: targetParentId };
        const position = targetParentId ? 'inside' : 'root';
        console.log("      Inserting node: ", nodeToInsert, ` at position: ${position}`);
        return insertNode(treeWithoutNode, targetParentId, nodeToInsert, position);
      });
      return;
    }

    console.log(`[App DragEnd] === Unhandled Scenario ===`);

  }, [selectedFolderId]);

  // --- Specific Reorder Handlers (called by main handleDragEnd) ---

  const handleReorderFolders = useCallback((activeId: string, overId: string) => {
    console.log(`[App:handleReorderFolders] Reordering ${activeId} over ${overId}`);
    setBookmarks(currentBookmarks => {
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

      const activeNode = findNodeById(currentBookmarks, activeId);
      const overNode = findNodeById(currentBookmarks, overId);
      if (!activeNode || !overNode || activeNode.parentId !== overNode.parentId) {
        console.error("Folder reorder failed: Nodes not found or not siblings.");
        return currentBookmarks;
      }
      const parentId = activeNode.parentId;

      if (parentId === undefined) { // Root level
        console.log("  Reordering root folders...");
        const oldIndex = currentBookmarks.findIndex(node => node.id === activeId);
        const newIndex = currentBookmarks.findIndex(node => node.id === overId);
        if (oldIndex === -1 || newIndex === -1) {
          console.error("    Root indices not found!"); return currentBookmarks;
        }
        console.log(`    Moving root index ${oldIndex} to ${newIndex}`);
        return arrayMove(currentBookmarks, oldIndex, newIndex); // arrayMove creates a new array
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
        const newTree = reorderRecursiveMap(currentBookmarks);
        // Check if the tree reference actually changed
        return newTree !== currentBookmarks ? newTree : currentBookmarks;
      }
    });
  }, []);

  const handleReorderBookmarks = useCallback((parentId: string | null, activeId: string, overId: string) => {
    console.log(`[App:handleReorderBookmarks] Reordering in parent ${parentId ?? 'ROOT'}: move ${activeId} over ${overId}`);
    setBookmarks(currentBookmarks => {
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
  }, []);

  // --- Context Menu Handlers ---
  const handleEditNode = useCallback((nodeId: string) => {
    console.log(`[App] Activating edit mode for node ${nodeId}`);
    setEditingNodeId(nodeId);
    // TODO: Implement inline editing or modal
  }, []);

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

    setBookmarks(currentBookmarks => {
      // Insert inside the target parent, or at the root
      const position = parentId ? 'inside' : 'root';
      return insertNode(currentBookmarks, parentId, newNode, position);
    });
  }, []);

  const handleAddBookmark = useCallback((parentId: string | null) => {
    const title = window.prompt("Enter the bookmark title:", "New Bookmark");
    if (!title || title.trim() === "") {
      console.log("[App] Add bookmark cancelled (no title).");
      return;
    }

    const url = window.prompt("Enter the bookmark URL:");
    if (!url || url.trim() === "") {
      console.log("[App] Add bookmark cancelled (no URL).");
      // Maybe inform user title was entered but URL is required?
      return;
    }

    // Basic URL validation (can be enhanced)
    try {
      new URL(url.trim()); // Check if it parses as a URL
    } catch (_) {
      alert("Invalid URL format. Please enter a valid URL (e.g., https://example.com).");
      console.log("[App] Add bookmark cancelled (invalid URL).");
      return;
    }

    const newNode: BookmarkNode = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: title.trim(),
      url: url.trim(), // Bookmarks have a URL
      parentId: parentId // Store parent ID
      // No children array for bookmarks
    };

    console.log(`[App] Adding new bookmark "${newNode.title}" inside parent: ${parentId ?? 'root'}`);

    setBookmarks(currentBookmarks => {
      // Insert inside the target parent, or at the root
      const position = parentId ? 'inside' : 'root';
      return insertNode(currentBookmarks, parentId, newNode, position);
    });
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

  /** Handles renaming a node after inline editing */
  const handleRenameNode = useCallback((nodeId: string, newTitle: string) => {
    console.log(`[App:handleRenameNode] Received call to rename node ${nodeId} to "${newTitle}"`); // Log entry
    setBookmarks(currentBookmarks => {
      // Function to recursively find and update the node
      const updateNodeTitle = (nodes: BookmarkNode[]): BookmarkNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            // Found the node, return a new object with the updated title
            console.log(`  Found node ${nodeId}, updating title.`);
            return { ...node, title: newTitle };
          }
          // If the node has children, recursively update them
          if (node.children) {
            const updatedChildren = updateNodeTitle(node.children);
            // Only return a new object if children actually changed
            if (updatedChildren !== node.children) {
              return { ...node, children: updatedChildren };
            }
          }
          // No changes needed for this node or its children
          return node;
        });
      };

      const updatedBookmarks = updateNodeTitle(currentBookmarks);

      // Check if the update actually changed the array to prevent unnecessary re-renders
      if (updatedBookmarks === currentBookmarks) {
        console.warn(`  Node ${nodeId} not found for renaming.`);
      }
      return updatedBookmarks;
    });
    setEditingNodeId(null); // Exit editing mode
  }, []);

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
                editingNodeId={editingNodeId}
                handleRenameNode={handleRenameNode}
              />
            </div>

            {/* Right Panel: Bookmark List */}
            <div className="flex-grow h-full min-w-0"> {/* Takes remaining space, scrollable */}
              <div className="flex-grow overflow-auto">
                <BookmarkListPanel
                  bookmarkNodes={rightPanelNodes} // Pass only the nodes for the right panel
                  onDeleteNode={handleDeleteNode}
                  onEditNode={handleEditNode} // Pass edit handler
                  onAddBookmark={handleAddBookmark} // Pass add bookmark handler (context might differ)
                  editingNodeId={editingNodeId} // Pass editing state
                  handleRenameNode={handleRenameNode} // Pass rename handler
                  duplicateIds={duplicateIds}
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