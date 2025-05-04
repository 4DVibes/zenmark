import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import 'react-contexify/dist/ReactContexify.css';
import { Theme, Item, Menu, Separator, Submenu, useContextMenu } from 'react-contexify';
import type { BookmarkNode, FlattenedBookmarkNode } from './types/bookmark';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragCancelEvent,
  rectIntersection
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import FileUpload from './components/FileUpload';
import SearchBar from './components/SearchBar';
import FolderTreePanel from './components/FolderTreePanel';
import BookmarkListPanel from './components/BookmarkListPanel';
import { loadBookmarks, saveBookmarks, clearBookmarks } from './utils/bookmarkStorage';
import { parseBookmarkFile } from './utils/bookmarkParser';
import {
  findNodeById,
  removeNodeById,
  insertNode,
  filterBookmarkTree,
  FilterResults,
  findDuplicateUrls,
  generateBookmarkHtml,
  flattenBookmarkTree,
  extractFolderTree,
  getNodeChildren,
  countNodesByType
} from './utils/treeUtils';
import { ROOT_FOLDER_DROP_ID } from './components/FolderTreePanel'; // Import the ID
import { useDebouncedEffect } from './hooks/useDebouncedEffect'; // Import the custom hook
import FolderContextMenu from './components/FolderContextMenu'; // Import context menu
import BookmarkContextMenu from './components/BookmarkContextMenu'; // Import context menu
import BookmarkItem from './components/BookmarkItem'; // Import BookmarkItem for DragOverlay rendering

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
  const [activeDragNode, setActiveDragNode] = useState<BookmarkNode | null>(null);

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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const nodeData = active.data.current?.node as BookmarkNode | undefined;
    const nodeType = active.data.current?.type as string | undefined;

    // Fix: Set activeDragNode for both folders and bookmarks
    if (nodeData && (nodeType === 'folder' || nodeType === 'bookmark')) {
      console.log(`[App DragStart] Setting active drag node: ${nodeData.title} (Type: ${nodeType})`);
      setActiveDragNode(nodeData);
    } else {
      console.warn('[App DragStart] Could not get node data or type for overlay.');
      setActiveDragNode(null);
    }
  };

  const handleDragCancel = (event: DragCancelEvent) => {
    console.log('[App DragCancel] Clearing active drag node.');
    setActiveDragNode(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragNode(null);
    console.log('[App DragEnd] Cleared active drag node.');

    const { active, over } = event;

    // Check for valid drop
    if (!over || !active.data.current || active.id === over.id) {
      console.log('Drag cancelled or invalid drop target.');
      return;
    }

    const activeNode = active.data.current.node as BookmarkNode;
    const activeType = active.data.current.type as string;
    const overId = over.id as string;
    // Get data from the droppable element (might not always exist)
    const overData = over.data.current;
    const overType = overData?.type as string | undefined;

    console.log(`Drag End: Item ${active.id} (${activeType}) dropped over ID: ${overId} (${overType ?? 'N/A'})`);

    // Fix: Check Move scenario first
    // Scenario 1 (Renumbered): Moving Folder/Bookmark onto a Folder or Root
    if (overId === ROOT_FOLDER_DROP_ID || (overType === 'folder')) {
      console.log(`  Scenario: Move ${activeType} to ${overId === ROOT_FOLDER_DROP_ID ? 'Root' : 'Folder'}`);
      setBookmarks((currentBookmarks) => {
        const nodeToMove = activeNode;
        console.log("    [Move] Node to move:", { id: nodeToMove.id, title: nodeToMove.title, originalParentId: nodeToMove.parentId });

        const treeWithoutNode = removeNodeById(currentBookmarks, nodeToMove.id);
        console.log("    [Move] Tree state after removing node (ref changed?", treeWithoutNode !== currentBookmarks, ")");

        let position: 'inside' | 'root' = 'inside';
        let finalTargetId: string | null = null;

        if (overId === ROOT_FOLDER_DROP_ID) {
          console.log("    [Move] Determined target: ROOT");
          position = 'root';
          finalTargetId = null;
        } else {
          console.log(`    [Move] Determined target: Folder ${overId}`);
          position = 'inside';
          finalTargetId = overId;
        }

        if (activeType === 'folder' && position === 'inside' && finalTargetId && findNodeById([nodeToMove], finalTargetId)) {
          console.warn("    [Move] Aborting: Cannot drop folder inside itself/descendant.");
          return currentBookmarks;
        }

        console.log(`    [Move] Updating parentId of moved node ${nodeToMove.id} to: ${finalTargetId}`);
        const updatedNodeToMove = { ...nodeToMove, parentId: finalTargetId };

        console.log(`    [Move] Inserting node...`, { node: updatedNodeToMove, position, targetId: finalTargetId });
        const newTree = insertNode(treeWithoutNode, finalTargetId, updatedNodeToMove, position);
        console.log("    [Move] Final new tree state (ref changed?", newTree !== treeWithoutNode, ")");

        return newTree;
      });
      return; // Handled
    }

    // Scenario 2 (Renumbered): Reordering Folders within the same parent (or root)
    else if (activeType === 'folder' && overType === 'folder') {
      handleReorderFolders(active.id as string, overId);
    }

    // Fix: Add Scenario 3: Reordering Bookmarks within the same list (selected folder)
    else if (activeType === 'bookmark' && overType === 'bookmark') {
      handleReorderBookmarks(active.id as string, overId);
    } else {
      console.log('  Scenario: Unknown or unhandled drop.', { activeType, overType, overId });
    }
  };

  // --- DND Handler for Reordering Folders ---
  const handleReorderFolders = useCallback((activeId: string, overId: string) => {
    console.log(`[App:handleReorderFolders] Reordering ${activeId} over ${overId}`);
    setBookmarks(currentBookmarks => {
      console.log("  [Reorder] Finding active node...");
      const activeNode = findNodeById(currentBookmarks, activeId);
      console.log("  [Reorder] Finding over node...");
      const overNode = findNodeById(currentBookmarks, overId);

      console.log("  [Reorder] Active Node Found:", activeNode ? { id: activeNode.id, title: activeNode.title, parentId: activeNode.parentId } : null);
      console.log("  [Reorder] Over Node Found:", overNode ? { id: overNode.id, title: overNode.title, parentId: overNode.parentId } : null);

      if (!activeNode || !overNode || activeNode.parentId !== overNode.parentId) {
        console.error("  [Reorder] Folder reorder failed: Nodes not found or parent IDs don't match.");
        return currentBookmarks;
      }

      const parentId = activeNode.parentId;
      console.log(`  [Reorder] Common Parent ID: ${parentId ?? 'ROOT'}`);

      if (parentId === undefined || parentId === null) { // Root level
        console.log("  [Reorder] Handling ROOT level reorder.");
        const oldIndex = currentBookmarks.findIndex((node: BookmarkNode) => node.id === activeId && !node.url);
        const newIndex = currentBookmarks.findIndex((node: BookmarkNode) => node.id === overId && !node.url);
        console.log(`  [Reorder] Root Indices: old=${oldIndex}, new=${newIndex}`);
        if (oldIndex === -1 || newIndex === -1) {
          console.error("    Root folder indices not found!");
          return currentBookmarks;
        }
        console.log(`    Moving root index ${oldIndex} to ${newIndex}`);
        const newRootTree = arrayMove(currentBookmarks, oldIndex, newIndex);
        console.log("  [Reorder] Root reorder complete. New tree ref === old tree ref?", newRootTree === currentBookmarks);
        return newRootTree;
      } else { // Nested level
        console.log(`  [Reorder] Handling NESTED level reorder under parent ${parentId}...`);
        let parentFound = false; // Flag to check if map function finds the parent
        const reorderRecursiveMap = (nodes: BookmarkNode[]): BookmarkNode[] => {
          return nodes.map(node => {
            if (node.id === parentId && node.children) {
              parentFound = true;
              console.log(`    [Reorder Map] Found parent node: ${node.title}`);
              const childFolders = node.children.filter(child => !child.url);
              console.log(`    [Reorder Map] Filtered child folders:`, childFolders.map(f => f.id));
              const oldIndex = childFolders.findIndex(child => child.id === activeId);
              const newIndex = childFolders.findIndex(child => child.id === overId);
              console.log(`    [Reorder Map] Nested Indices: old=${oldIndex}, new=${newIndex}`);
              if (oldIndex === -1 || newIndex === -1) {
                console.error(`      Nested folder indices not found in parent ${parentId}!`);
                return node; // Return original node if error
              }
              console.log(`      Moving nested folder index ${oldIndex} to ${newIndex}`);
              const reorderedFolders = arrayMove(childFolders, oldIndex, newIndex);
              const bookmarkChildren = node.children.filter(child => !!child.url);
              const newChildren = [...reorderedFolders, ...bookmarkChildren];
              console.log(`      New children order for parent ${parentId}:`, newChildren.map(c => c.id));
              return { ...node, children: newChildren };
            }
            if (node.children) {
              // console.log(`    [Reorder Map] Recursing into children of ${node.title}`); // Optional: very verbose
              const updatedChildren = reorderRecursiveMap(node.children);
              if (updatedChildren !== node.children) {
                // console.log(`    [Reorder Map] Children changed for ${node.title}, returning new node.`); // Optional: verbose
                return { ...node, children: updatedChildren };
              }
            }
            return node;
          });
        }
        const newNestedTree = reorderRecursiveMap(currentBookmarks);
        if (!parentFound) {
          console.error(`  [Reorder] Nested reorder failed: Parent ${parentId} not found during map.`);
        }
        console.log("  [Reorder] Nested reorder complete. New tree ref === old tree ref?", newNestedTree === currentBookmarks);
        return newNestedTree !== currentBookmarks ? newNestedTree : currentBookmarks;
      }
    });
  }, []);

  // Fix: Add DND Handler for Reordering Bookmarks
  const handleReorderBookmarks = useCallback((activeId: string, overId: string) => {
    console.log(`[App:handleReorderBookmarks] Reordering ${activeId} over ${overId}`);
    setBookmarks(currentBookmarks => {
      console.log("  [Bookmark Reorder] Finding active node...");
      const activeNode = findNodeById(currentBookmarks, activeId);
      console.log("  [Bookmark Reorder] Finding over node...");
      const overNode = findNodeById(currentBookmarks, overId);

      console.log("  [Bookmark Reorder] Active Node Found:", activeNode ? { id: activeNode.id, title: activeNode.title, parentId: activeNode.parentId } : null);
      console.log("  [Bookmark Reorder] Over Node Found:", overNode ? { id: overNode.id, title: overNode.title, parentId: overNode.parentId } : null);

      if (!activeNode || !overNode || activeNode.parentId !== overNode.parentId) {
        console.error("  [Bookmark Reorder] Bookmark reorder failed: Nodes not found or have different parents.", { activeParent: activeNode?.parentId, overParent: overNode?.parentId });
        return currentBookmarks; // Return original state if checks fail
      }

      const parentId = activeNode.parentId; // Both have the same parent
      console.log(`  [Bookmark Reorder] Nodes share parent: ${parentId ?? 'root'}`);

      if (parentId === null) {
        // Reordering root-level bookmarks
        console.log("  [Bookmark Reorder] Reordering in root...");
        const oldIndex = currentBookmarks.findIndex(node => node.id === activeId);
        const newIndex = currentBookmarks.findIndex(node => node.id === overId);
        if (oldIndex === -1 || newIndex === -1) {
          console.error("  [Bookmark Reorder] Failed to find indices in root bookmarks.");
          return currentBookmarks;
        }
        const reorderedRoot = arrayMove(currentBookmarks, oldIndex, newIndex);
        console.log("  [Bookmark Reorder] Root reordered successfully.");
        return reorderedRoot;
      } else {
        // Reordering bookmarks within a folder
        console.log(`  [Bookmark Reorder] Reordering within folder ${parentId}...`);
        // Fix: Replace mapTree with recursive update function
        const updateTreeRecursively = (nodes: BookmarkNode[]): BookmarkNode[] => {
          return nodes.map((node: BookmarkNode) => {
            // If this is the parent node, update its children
            if (node.id === parentId && node.children) {
              console.log(`    [Bookmark Reorder] Found parent folder ${parentId}. Reordering children...`);
              const oldIndex = node.children.findIndex((child: BookmarkNode) => child.id === activeId);
              const newIndex = node.children.findIndex((child: BookmarkNode) => child.id === overId);
              if (oldIndex === -1 || newIndex === -1) {
                console.error("    [Bookmark Reorder] Failed to find indices in folder children.");
                return node; // Return original node if indices not found
              }
              // Create a new children array with the reordered items
              const reorderedChildren = arrayMove(node.children, oldIndex, newIndex);
              console.log(`    [Bookmark Reorder] Children reordered for ${parentId}.`);
              // Return a new node object with the new children array
              return { ...node, children: reorderedChildren };
            }
            // If the node has children, recurse
            else if (node.children) {
              const updatedChildren = updateTreeRecursively(node.children);
              // If children changed, return new node object
              if (updatedChildren !== node.children) {
                return { ...node, children: updatedChildren };
              }
            }
            // Otherwise, return the node unchanged
            return node;
          });
        };
        return updateTreeRecursively(currentBookmarks);
      }
    });
  }, []);

  // --- End DND Handlers ---

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
    console.log(`[App] handleAddBookmark triggered for parent: ${parentId}`);
    const newBookmark: BookmarkNode = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}-bookmark`,
      title: "New Bookmark",
      url: "", // Initialize with empty URL
      parentId: parentId,
      children: undefined, // Bookmarks don't have children
    };

    setBookmarks(currentBookmarks => {
      const position = parentId ? 'inside' : 'root';
      console.log(`[App] Calling insertNode for new bookmark. Parent: ${parentId}, Position: ${position}`);
      return insertNode(currentBookmarks, parentId, newBookmark, position);
    });

    // Optionally, trigger rename right away
    setTimeout(() => setEditingNodeId(newBookmark.id), 0);
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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={rectIntersection}
    >
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
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Context Menus (Rendered outside the main layout flow) */}
      <FolderContextMenu />
      <BookmarkContextMenu />

      <DragOverlay dropAnimation={null}>
        {activeDragNode ? (
          // Render a simplified version based on type
          activeDragNode.children ? (
            // Folder Representation (existing)
            <div style={{
              padding: '8px 12px',
              backgroundColor: 'lightblue',
              borderRadius: '4px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              cursor: 'grabbing'
            }}>
              Dragging Folder: {activeDragNode.title}
            </div>
          ) : (
            // Bookmark Representation (new)
            <div style={{
              display: 'inline-block',
              padding: '8px 12px',
              backgroundColor: 'lightgreen', // Different color for bookmarks
              borderRadius: '4px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              cursor: 'grabbing'
            }}>
              Dragging Bookmark: {activeDragNode.title}
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default App;