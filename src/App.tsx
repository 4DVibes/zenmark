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
  rectIntersection,
  closestCenter
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import FileUpload from './components/FileUpload';
import SearchBar from './components/SearchBar';
import FolderTreePanel, { ROOT_FOLDER_DROP_ID, ALL_BOOKMARKS_ITEM_ID } from './components/FolderTreePanel';
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
  countNodesByType,
  addNodeToTree,
  mapTree
} from './utils/treeUtils';
import FolderContextMenu from './components/FolderContextMenu';
import BookmarkContextMenu from './components/BookmarkContextMenu';
import BookmarkItem from './components/BookmarkItem';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from './utils/debounce';
import Modal from './components/Modal';
import AddFolderModalContent from './components/AddFolderModalContent';
import AddBookmarkModalContent from './components/AddBookmarkModalContent';
import zenmarkLogo from './assets/zenmark_logo.png';

const SAVE_DEBOUNCE_DELAY = 500;
const SEARCH_DEBOUNCE_DELAY = 300;

export const FOLDER_MENU_ID = "folder-menu";
export const BOOKMARK_MENU_ID = "bookmark-menu";

const getDuplicateIdSet = (tree: BookmarkNode[]): Set<string> => {
  const urlMap = findDuplicateUrls(tree);
  const duplicates = new Set<string>();
  urlMap.forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach(id => duplicates.add(id));
    }
  });
  console.log('[getDuplicateIdSet] Calculated duplicate IDs:', duplicates);
  return duplicates;
};

const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(ROOT_FOLDER_DROP_ID);
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [nodeCounts, setNodeCounts] = useState<{ total: number, folders: number, bookmarks: number } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [activeDragNode, setActiveDragNode] = useState<BookmarkNode | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [isAddBookmarkModalOpen, setIsAddBookmarkModalOpen] = useState(false);
  const [modalTargetParentId, setModalTargetParentId] = useState<string | null>(null);

  const debouncedSave = useMemo(() => debounce(saveBookmarks, SAVE_DEBOUNCE_DELAY), []);

  // Apply search filtering to the entire bookmark tree
  const { filteredNodes: filteredBookmarksMemo, matchingFolderIds: FOLDER_IDS_MATCHING_SEARCH_QUERY } = useMemo(() => {
    console.log(`[App] Filtering all bookmarks with searchTerm: "${searchTerm}"`);
    if (!searchTerm) {
      return { filteredNodes: bookmarks, matchingFolderIds: new Set<string>() };
    }
    const results = filterBookmarkTree(bookmarks, searchTerm);
    console.log(`[App] filterBookmarkTree results: ${results.filteredNodes.length} nodes, ${results.matchingFolderIds.size} matching folders`);
    return results;
  }, [bookmarks, searchTerm]);

  const handleTreeUpdate = useCallback((newTreeOrUpdater: BookmarkNode[] | ((currentTree: BookmarkNode[]) => BookmarkNode[])) => {
    console.log('[App] handleTreeUpdate called...');
    let newTree: BookmarkNode[];
    if (typeof newTreeOrUpdater === 'function') {
      console.log('  Updater function received, calculating new tree...');
      setBookmarks(currentTree => {
        newTree = newTreeOrUpdater(currentTree);
        console.log('  New tree calculated by updater, updating derived state...');
        setNodeCounts(countNodesByType(newTree));
        setDuplicateIds(getDuplicateIdSet(newTree));
        console.log('  Scheduling save...');
        debouncedSave(newTree);
        return newTree;
      });
    } else {
      console.log('  Direct new tree received.');
      newTree = newTreeOrUpdater;
      setBookmarks(newTree);
      console.log('  Updating derived state...');
      setNodeCounts(countNodesByType(newTree));
      setDuplicateIds(getDuplicateIdSet(newTree));
      console.log('  Scheduling save...');
      debouncedSave(newTree);
    }
  }, [debouncedSave]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const loadedBookmarks = await loadBookmarks();
        console.log('[App] Loaded bookmarks from IndexedDB:', loadedBookmarks);
        handleTreeUpdate(loadedBookmarks);
      } catch (err: any) {
        console.error('[App] Error loading bookmarks:', err);
        setError(`Failed to load bookmarks: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [handleTreeUpdate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const nodeData = active.data.current?.node as BookmarkNode | undefined;
    const nodeType = active.data.current?.type as string | undefined;
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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragNode(null);
    const { active, over } = event;

    if (!over || !active.data.current || active.id === over.id) {
      console.log('[App DragEnd] Cancelled: No target or dropped on self.');
      return;
    }

    const activeNode = active.data.current.node as BookmarkNode;
    const activeType = active.data.current.type as string;
    const overId = over.id as string;
    const overData = over.data.current;
    const overType = overData?.type as string | undefined;

    console.log(`[App DragEnd] Event: Item ${active.id} (${activeType}) dropped over ID: ${overId} (${overType ?? 'N/A'})`);

    // Handle drops onto ROOT, the "All Bookmarks" item, or any regular folder
    if (overId === ROOT_FOLDER_DROP_ID || overId === ALL_BOOKMARKS_ITEM_ID || (overType === 'folder')) {
      const isRootDropTarget = overId === ROOT_FOLDER_DROP_ID || overId === ALL_BOOKMARKS_ITEM_ID;
      console.log(`  Scenario: Move ${activeType} to ${isRootDropTarget ? 'Root (via All Bookmarks or direct root drop)' : 'Folder ' + overId}`);

      // Prevent dragging a root-level folder to the root again
      if (activeType === 'folder' && (activeNode.parentId === null || activeNode.parentId === undefined) && isRootDropTarget) {
        console.warn("    [Move] Aborting: Cannot drag a root folder to the root again.");
        return;
      }

      handleTreeUpdate((currentBookmarks) => {
        const nodeToMove = findNodeById(currentBookmarks, active.id as string);
        if (!nodeToMove) {
          console.warn("    [Move] Node to move not found in currentBookmarks. Aborting.");
          return currentBookmarks;
        }

        const finalTargetId = isRootDropTarget ? null : overId;
        const position = finalTargetId ? 'inside' : 'root';

        if (activeType === 'folder' && position === 'inside' && finalTargetId && findNodeById([nodeToMove], finalTargetId)) {
          console.warn("    [Move] Aborting: Cannot drop folder inside itself/descendant.");
          return currentBookmarks;
        }

        console.log(`    [Move] Removing node ${nodeToMove.id} (parentId: ${nodeToMove.parentId}, title: ${nodeToMove.title}) from original position.`);
        const treeWithoutNode = removeNodeById(currentBookmarks, nodeToMove.id);

        console.log(`    [Move] Updating parentId of moved node ${nodeToMove.id} to: ${finalTargetId}`);
        const updatedNodeToMove = { ...nodeToMove, parentId: finalTargetId };

        console.log(`    [Move] Inserting node (title: ${updatedNodeToMove.title}, new parentId: ${updatedNodeToMove.parentId}) with position: ${position}, targetId (for insertNode): ${finalTargetId === null ? 'null (root)' : finalTargetId}`);
        const newTree = insertNode(treeWithoutNode, finalTargetId, updatedNodeToMove, position);

        if (finalTargetId === null) {
          console.log(`    [Move to Root] New tree length: ${newTree.length}. Node inserted:`, newTree.find(n => n.id === updatedNodeToMove.id));
          console.log(`    [Move to Root] Full newTree (first 5):`, newTree.slice(0, 5).map(n => ({ id: n.id, title: n.title, parentId: n.parentId })));
        }
        console.log("    [Move] Move operation complete.");
        return newTree;
      });
      return;
    }

    if (activeType === 'folder' && overType === 'folder') {
      console.log("  Scenario: Reorder Folders (Sibling Check)");
      handleReorderFolders(active.id as string, overId);
      return;
    }

    if (activeType === 'bookmark' && overType === 'bookmark') {
      console.log("  Scenario: Reorder Bookmarks (Sibling Check)");
      handleReorderBookmarks(active.id as string, overId);
      return;
    }

    console.warn(`[App DragEnd] Unhandled DragEnd scenario: Active ${activeType} (${active.id}) over ${overType ?? 'N/A'} (${over.id})`);

  }, [handleTreeUpdate]);

  const handleReorderFolders = useCallback((activeId: string, overId: string) => {
    console.log(`[App:handleReorderFolders] Reordering ${activeId} over ${overId}`);
    handleTreeUpdate(currentBookmarks => {
      const activeNode = findNodeById(currentBookmarks, activeId);
      const overNode = findNodeById(currentBookmarks, overId);

      if (!activeNode || !overNode || activeNode.parentId !== overNode.parentId) {
        console.error("  [Reorder] Folder reorder failed: Nodes not found or parent IDs don't match.");
        return currentBookmarks;
      }

      const parentId = activeNode.parentId;
      console.log(`  [Reorder] Common Parent ID: ${parentId ?? 'ROOT'}`);

      if (parentId === undefined || parentId === null) {
        console.log("  [Reorder] Handling ROOT level reorder.");
        const oldIndex = currentBookmarks.findIndex((node: BookmarkNode) => node.id === activeId);
        const newIndex = currentBookmarks.findIndex((node: BookmarkNode) => node.id === overId);
        if (oldIndex === -1 || newIndex === -1) {
          console.error("    Root folder indices not found!"); return currentBookmarks;
        }
        console.log(`    Moving root index ${oldIndex} to ${newIndex}`);
        return arrayMove(currentBookmarks, oldIndex, newIndex);
      } else {
        console.log(`  [Reorder] Handling NESTED level reorder under parent ${parentId}...`);
        const reorderRecursiveMap = (nodes: BookmarkNode[]): BookmarkNode[] => {
          return nodes.map(node => {
            if (node.id === parentId && node.children) {
              const childFolders = node.children.filter(child => child.children !== undefined);
              const oldIndex = childFolders.findIndex(child => child.id === activeId);
              const newIndex = childFolders.findIndex(child => child.id === overId);
              if (oldIndex === -1 || newIndex === -1) {
                console.error(`      Nested folder indices not found in parent ${parentId}!`); return node;
              }
              const reorderedFolders = arrayMove(childFolders, oldIndex, newIndex);
              const bookmarkChildren = node.children.filter(child => child.children === undefined);
              const newChildren = [...reorderedFolders, ...bookmarkChildren];
              return { ...node, children: newChildren };
            }
            if (node.children) {
              const updatedChildren = reorderRecursiveMap(node.children);
              if (updatedChildren !== node.children) {
                return { ...node, children: updatedChildren };
              }
            }
            return node;
          });
        };
        const newTree = reorderRecursiveMap(currentBookmarks);
        return newTree !== currentBookmarks ? newTree : currentBookmarks;
      }
    });
  }, [handleTreeUpdate]);

  const handleReorderBookmarks = useCallback((activeId: string, overId: string) => {
    console.log(`[App:handleReorderBookmarks] Reordering ${activeId} over ${overId}`);
    handleTreeUpdate(currentBookmarks => {
      const activeNode = findNodeById(currentBookmarks, activeId);
      const overNode = findNodeById(currentBookmarks, overId);

      if (!activeNode || !overNode || activeNode.parentId !== overNode.parentId) {
        console.error("  [Bookmark Reorder] Bookmark reorder failed: Nodes not found or have different parents.");
        return currentBookmarks;
      }

      const parentId = activeNode.parentId;
      console.log(`  [Bookmark Reorder] Nodes share parent: ${parentId ?? 'root'}`);

      if (parentId === null || parentId === undefined) {
        console.log("  [Bookmark Reorder] Reordering in root...");
        const rootBookmarks = currentBookmarks.filter(node => node.children === undefined);
        const oldIndex = rootBookmarks.findIndex(node => node.id === activeId);
        const newIndex = rootBookmarks.findIndex(node => node.id === overId);
        if (oldIndex === -1 || newIndex === -1) {
          console.error("  [Bookmark Reorder] Failed to find indices in root bookmarks."); return currentBookmarks;
        }
        const reorderedRootBookmarks = arrayMove(rootBookmarks, oldIndex, newIndex);
        const rootFolders = currentBookmarks.filter(node => node.children !== undefined);
        return [...rootFolders, ...reorderedRootBookmarks];

      } else {
        console.log(`  [Bookmark Reorder] Reordering within folder ${parentId}...`);
        const updateTreeRecursively = (nodes: BookmarkNode[]): BookmarkNode[] => {
          return nodes.map(node => {
            if (node.id === parentId && node.children) {
              const bookmarksInChildren = node.children.filter(child => child.children === undefined);
              const oldIndex = bookmarksInChildren.findIndex(child => child.id === activeId);
              const newIndex = bookmarksInChildren.findIndex(child => child.id === overId);
              if (oldIndex === -1 || newIndex === -1) {
                console.error("    [Bookmark Reorder] Failed to find indices in folder children."); return node;
              }
              const reorderedBookmarks = arrayMove(bookmarksInChildren, oldIndex, newIndex);
              const foldersInChildren = node.children.filter(child => child.children !== undefined);
              return { ...node, children: [...foldersInChildren, ...reorderedBookmarks] };
            }
            if (node.children) {
              const updatedChildren = updateTreeRecursively(node.children);
              if (updatedChildren !== node.children) {
                return { ...node, children: updatedChildren };
              }
            }
            return node;
          });
        };
        const newTree = updateTreeRecursively(currentBookmarks);
        return newTree !== currentBookmarks ? newTree : currentBookmarks;
      }
    });
  }, [handleTreeUpdate]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleSelectFolder = useCallback((folderId: string | null) => {
    console.log('[App] Selected Folder ID:', folderId);
    setSelectedFolderId(folderId ?? ROOT_FOLDER_DROP_ID);
    setSearchTerm('');
  }, []);

  const handleOpenAddFolderModal = useCallback((parentId: string | null) => {
    console.log(`[App] Opening Add Folder modal for parent: ${parentId ?? 'root'}`);
    setModalTargetParentId(parentId);
    setIsAddFolderModalOpen(true);
  }, []);

  const handleOpenAddBookmarkModal = useCallback((parentId: string | null) => {
    console.log(`[App] Opening Add Bookmark modal for parent: ${parentId ?? 'root'}`);
    setModalTargetParentId(parentId);
    setIsAddBookmarkModalOpen(true);
  }, []);

  const handleSaveFolder = useCallback((folderName: string) => {
    console.log(`[App] Saving new folder "${folderName}" for parent: ${modalTargetParentId ?? 'root'}`);
    if (!folderName) return;

    const newNode: BookmarkNode = {
      id: uuidv4(),
      title: folderName,
      children: [],
      parentId: modalTargetParentId === ROOT_FOLDER_DROP_ID ? null : modalTargetParentId
    };
    const actualTargetId = modalTargetParentId === ROOT_FOLDER_DROP_ID ? null : modalTargetParentId;
    handleTreeUpdate(currentBookmarks => insertNode(currentBookmarks, actualTargetId, newNode, 'inside'));
    setIsAddFolderModalOpen(false); // Close modal
  }, [modalTargetParentId, handleTreeUpdate]);

  const handleSaveBookmark = useCallback((title: string, url: string) => {
    console.log(`[App] Saving new bookmark "${title}" for parent: ${modalTargetParentId ?? 'root'}`);
    if (!title || !url) return;

    const actualTargetParentIdForNode = modalTargetParentId === ROOT_FOLDER_DROP_ID ? null : modalTargetParentId;

    const newBookmark: BookmarkNode = {
      id: uuidv4(),
      title: title,
      url: url,
      parentId: actualTargetParentIdForNode,
      children: undefined,
    };
    handleTreeUpdate(currentBookmarks => {
      const isRootInsert = modalTargetParentId === ROOT_FOLDER_DROP_ID || modalTargetParentId === null;
      const position = isRootInsert ? 'root' : 'inside';
      const actualTargetIdForInsert = isRootInsert ? null : modalTargetParentId;
      return insertNode(currentBookmarks, actualTargetIdForInsert, newBookmark, position);
    });
    setIsAddBookmarkModalOpen(false); // Close modal
  }, [modalTargetParentId, handleTreeUpdate]);

  const handleAddFolder = handleOpenAddFolderModal;
  const handleAddBookmark = handleOpenAddBookmarkModal;

  const handleDeleteNode = useCallback((nodeId: string) => {
    console.log(`Attempting to delete node: ${nodeId}`);
    handleTreeUpdate((currentBookmarks) => {
      const nodeToDelete = findNodeById(currentBookmarks, nodeId);
      if (!nodeToDelete) {
        console.warn(`Node ${nodeId} not found for deletion.`);
        return currentBookmarks;
      }
      if (nodeToDelete.children && nodeToDelete.children.length > 0) {
        if (!window.confirm(`Delete folder "${nodeToDelete.title}" and all contents?`)) return currentBookmarks;
      } else {
        if (!window.confirm(`Delete "${nodeToDelete.title}"?`)) return currentBookmarks;
      }
      const newTree = removeNodeById(currentBookmarks, nodeId);
      console.log(`Node ${nodeId} deleted.`);
      if (selectedFolderId === nodeId) {
        setSelectedFolderId(ROOT_FOLDER_DROP_ID);
      }
      return newTree;
    });
  }, [handleTreeUpdate, selectedFolderId]);

  const handleRenameNode = useCallback((nodeId: string, newTitle: string) => {
    console.log(`[App:handleRenameNode] Renaming node ${nodeId} to \"${newTitle}\"`);
    handleTreeUpdate(currentBookmarks => {
      const renameRecursiveMap = (nodes: BookmarkNode[]): BookmarkNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            console.log(`  Found node ${nodeId}, updating title.`);
            return { ...node, title: newTitle };
          }
          if (node.children) {
            const updatedChildren = renameRecursiveMap(node.children);
            if (updatedChildren !== node.children) {
              return { ...node, children: updatedChildren };
            }
          }
          return node;
        });
      };
      const updatedBookmarks = renameRecursiveMap(currentBookmarks);
      if (updatedBookmarks === currentBookmarks) {
        console.warn(`  Node ${nodeId} not found for renaming.`);
      }
      return updatedBookmarks;
    });
    setEditingNodeId(null);
  }, [handleTreeUpdate]);

  const handleRemoveDuplicates = useCallback(() => {
    if (duplicateIds.size === 0) return;
    if (window.confirm(`Remove ${duplicateIds.size} duplicate bookmarks?`)) {
      console.log("Removing duplicates...");
      handleTreeUpdate(currentBookmarks => {
        const removeDuplicatesRecursive = (nodes: BookmarkNode[]): BookmarkNode[] => {
          return nodes
            .filter(node => !(node.url && duplicateIds.has(node.id)))
            .map(node => {
              if (node.children) {
                return { ...node, children: removeDuplicatesRecursive(node.children) };
              }
              return node;
            });
        };
        return removeDuplicatesRecursive(currentBookmarks);
      });
    }
  }, [duplicateIds, handleTreeUpdate]);

  const handleClearData = useCallback(() => {
    if (window.confirm("Clear all local data?")) {
      handleTreeUpdate([]);
      setSelectedFolderId(ROOT_FOLDER_DROP_ID);
      setSearchTerm('');
      setError(null);
      clearBookmarks()
        .then(() => console.log('[App] Cleared bookmarks from IndexedDB.'))
        .catch((err: any) => console.error('[App] Error clearing IndexedDB:', err));
    }
  }, [handleTreeUpdate]);

  const handleExport = () => {
    if (bookmarks.length === 0) return;
    console.log('Exporting bookmarks...');
    try {
      const htmlContent = generateBookmarkHtml(bookmarks);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'zenmark_bookmarks.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      console.log('Bookmarks exported successfully.');
    } catch (error) {
      console.error('Failed to export bookmarks:', error);
      alert('Failed to export bookmarks.');
    }
  };

  const handleFileUpload = async (file: File | null) => {
    if (file) {
      console.log(`[App] handleFileUpload: Starting processing for ${file.name}`);
      setLoading(true);
      setError(null);
      setUploadedFileName(file.name);
      // Clear existing data before processing the new file
      try {
        await clearBookmarks(); // Clear from storage
        console.log('[App] handleFileUpload: Cleared data from IndexedDB.');
        handleTreeUpdate([]); // Clear state via handler
        setSelectedFolderId(ROOT_FOLDER_DROP_ID);
        console.log('[App] handleFileUpload: Cleared tree state and reset selected folder.');
      } catch (clearError) {
        console.error('[App] handleFileUpload: Error clearing data before upload:', clearError);
        setError('Failed to clear previous data before loading.');
        setLoading(false);
        return; // Stop if clearing failed
      }

      try {
        // const htmlContent = await file.text(); // Don't read content here
        // console.log('[App] handleFileUpload: Read file content.');

        // Pass the File object directly to the parser
        const tree = await parseBookmarkFile(file);

        console.log('[App] handleFileUpload: Parsed bookmark tree:', tree ? 'Success' : 'Failed', tree ? `(${tree.length} top-level nodes)` : '');
        // Add detailed log for debugging parsing issues
        if (tree) console.log('[App] handleFileUpload: Parsed structure (sample):', JSON.stringify(tree.slice(0, 2), null, 2));

        if (tree && tree.length > 0) {
          console.log('[App] handleFileUpload: Updating tree state via handleTreeUpdate...');
          handleTreeUpdate(tree);
          const firstNodeId = tree.find(node => node.children)?.id || tree[0]?.id || ROOT_FOLDER_DROP_ID;
          setSelectedFolderId(firstNodeId);
          console.log('[App] handleFileUpload: Tree state updated. Selected folder ID set to:', firstNodeId);
        } else if (tree && tree.length === 0) {
          console.warn('[App] handleFileUpload: Parsing successful but resulted in an empty tree.');
          // Kept state cleared from above
          setError('Bookmarks file appears to be empty or contains no valid bookmarks.');
        } else {
          console.error('[App] handleFileUpload: Parsing failed, parseBookmarkFile returned null or undefined');
          setError('Failed to parse bookmarks file. Check file format.');
          handleTreeUpdate([]); // Ensure state is empty on failure
          setUploadedFileName(null);
        }
      } catch (error: any) {
        console.error('[App] handleFileUpload: Error processing file:', error);
        setError(`Error processing file: ${error.message}`);
        handleTreeUpdate([]); // Ensure state is empty on error
        setUploadedFileName(null);
      } finally {
        setLoading(false);
        console.log('[App] handleFileUpload: Finished processing.');
      }
    }
  };

  const folderTreeForPanel = useMemo(() => {
    console.log('[App] Recalculating folderTreeForPanel for display...');
    return extractFolderTree(bookmarks); // Full folder structure for navigation
  }, [bookmarks]);

  const rightPanelNodesToDisplay = useMemo(() => {
    console.log(`[App] Recalculating rightPanelNodesToDisplay for selectedFolderId: ${selectedFolderId} with searchTerm: "${searchTerm}"`);
    const sourceTree = searchTerm ? filteredBookmarksMemo : bookmarks;

    if (selectedFolderId === ROOT_FOLDER_DROP_ID) {
      // If searching, show all top-level bookmarks from the filtered tree.
      // If not searching, show only true root bookmarks from the original tree.
      const rootBookmarks = sourceTree.filter(node =>
        node.children === undefined && // It's a bookmark
        (searchTerm ? true : node.parentId === null) // If searching, any top-level; else, only actual root
      );
      console.log(`[App] Root selected. Found ${rootBookmarks.length} root bookmarks from sourceTree.`);
      return rootBookmarks;
    } else if (selectedFolderId) {
      // Find the selected folder within the appropriate tree (filtered or original)
      const folder = findNodeById(sourceTree, selectedFolderId);
      if (folder && folder.children) {
        // Children are already filtered if sourceTree is filteredBookmarksMemo
        const folderBookmarks = folder.children.filter(node => node.children === undefined);
        console.log(`[App] Folder ${selectedFolderId} (${folder.title}) selected. Found ${folderBookmarks.length} bookmark children in sourceTree.`);
        return folderBookmarks;
      } else {
        console.warn(`[App] Selected folder ${selectedFolderId} not found in sourceTree or has no children.`);
        return [];
      }
    }
    console.log(`[App] No folderID or invalid selectedFolderId. Returning empty array for right panel.`);
    return [];
  }, [bookmarks, filteredBookmarksMemo, selectedFolderId, searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg font-semibold">Loading...</p>
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
      <div className="min-h-screen bg-[#E9EEEB] flex flex-col items-center justify-center p-4">
        <div className="bg-white shadow-md rounded-lg p-4 max-w-7xl w-full h-[85vh] flex flex-col">
          <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-gray-200 flex-shrink-0">
            <img src={zenmarkLogo} alt="Zenmark Logo" className="h-20 w-20" />
            <h1 className="text-2xl font-bold text-gray-800 uppercase font-sans font-light">Zenmark</h1>
          </div>

          <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:justify-between lg:items-center mb-4 pb-4 flex-shrink-0">
            <div className="flex flex-col space-y-2 lg:flex-row lg:space-y-0 lg:items-center lg:space-x-4">
              <FileUpload
                onUpload={handleFileUpload}
                onClearData={handleClearData}
                hasData={bookmarks.length > 0}
                uploadedFileName={uploadedFileName}
                nodeCounts={nodeCounts}
              />
            </div>

            {/* Right side: Actions (Export, Duplicates) */}
            {/* Responsive: Stack vertical, align end default. Row, center, spaced on lg */}
            <div className="flex flex-col items-end space-y-2 lg:flex-row lg:items-center lg:space-y-0 lg:space-x-2">
              {error && <p className="error-message text-red-600 text-sm text-right lg:text-left lg:mr-4 w-full lg:w-auto">Error: {error}</p>} { /* Adjusted error alignment/width */}
              <div className="w-full lg:w-auto lg:max-w-xs"> {/* SearchBar container */}
                <SearchBar query={searchTerm} onQueryChange={handleSearch} />
              </div>
              {duplicateIds.size > 0 && (
                <button
                  onClick={handleRemoveDuplicates}
                  // Responsive: Full width default, auto on lg
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm w-full lg:w-auto"
                  title={`Remove all ${duplicateIds.size} duplicate bookmark entries`}
                >
                  Remove Duplicates ({duplicateIds.size})
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={bookmarks.length === 0}
                // Responsive: Full width default, auto on lg
                className={`bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm w-full lg:w-auto ${bookmarks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Export
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row flex-grow min-h-0">
            <div className="w-full lg:w-1/3 lg:max-w-xs flex-shrink-0 h-full mb-4 lg:mb-0 lg:mr-4">
              <FolderTreePanel
                folderTree={folderTreeForPanel} // Use the full folder tree for navigation
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
                searchQuery={searchTerm}
                matchingFolderIds={FOLDER_IDS_MATCHING_SEARCH_QUERY} // Pass a set of matching folder IDs for dimming
                onDeleteNode={handleDeleteNode}
                onEditNode={setEditingNodeId}
                onAddFolder={handleAddFolder}
                onAddBookmark={handleAddBookmark}
                editingNodeId={editingNodeId}
                handleRenameNode={handleRenameNode}
              />
            </div>

            <div className="w-full lg:flex-grow h-full min-w-0 flex flex-col">
              <div className="flex-grow overflow-auto">
                <BookmarkListPanel
                  bookmarkNodes={rightPanelNodesToDisplay} // Use the correctly filtered nodes
                  onDeleteNode={handleDeleteNode}
                  onEditNode={setEditingNodeId}
                  onAddBookmark={() => handleAddBookmark(selectedFolderId)}
                  editingNodeId={editingNodeId}
                  handleRenameNode={handleRenameNode}
                  duplicateIds={duplicateIds}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      <FolderContextMenu />
      <BookmarkContextMenu />

      <DragOverlay dropAnimation={null}>
        {activeDragNode ? (
          activeDragNode.children ? (
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
            <div style={{
              display: 'inline-block',
              padding: '8px 12px',
              backgroundColor: 'lightgreen',
              borderRadius: '4px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              cursor: 'grabbing'
            }}>
              Dragging Bookmark: {activeDragNode.title}
            </div>
          )
        ) : null}
      </DragOverlay>

      <Modal
        isOpen={isAddFolderModalOpen}
        onClose={() => setIsAddFolderModalOpen(false)}
        title="Add New Folder"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddFolderModalOpen(false)}
              className="rounded bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-folder-form"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Save Folder
            </button>
          </>
        }
      >
        <AddFolderModalContent
          onSubmit={handleSaveFolder}
          onCancel={() => setIsAddFolderModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isAddBookmarkModalOpen}
        onClose={() => setIsAddBookmarkModalOpen(false)}
        title="Add New Bookmark"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddBookmarkModalOpen(false)}
              className="rounded bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-bookmark-form"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Save Bookmark
            </button>
          </>
        }
      >
        <AddBookmarkModalContent
          onSubmit={handleSaveBookmark}
          onCancel={() => setIsAddBookmarkModalOpen(false)}
        />
      </Modal>

    </DndContext>
  );
};

export default App;