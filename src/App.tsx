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
import FolderTreePanel, { ROOT_FOLDER_DROP_ID } from './components/FolderTreePanel';
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

  const debouncedSave = useMemo(() => debounce(saveBookmarks, SAVE_DEBOUNCE_DELAY), []);

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

    if (overId === ROOT_FOLDER_DROP_ID || (overType === 'folder')) {
      console.log(`  Scenario: Move ${activeType} to ${overId === ROOT_FOLDER_DROP_ID ? 'Root' : 'Folder ' + overId}`);
      handleTreeUpdate((currentBookmarks) => {
        const nodeToMove = findNodeById(currentBookmarks, active.id as string);
        if (!nodeToMove) return currentBookmarks;

        const finalTargetId = overId === ROOT_FOLDER_DROP_ID ? null : overId;
        const position = finalTargetId ? 'inside' : 'root';

        if (activeType === 'folder' && position === 'inside' && finalTargetId && findNodeById([nodeToMove], finalTargetId)) {
          console.warn("    [Move] Aborting: Cannot drop folder inside itself/descendant.");
          return currentBookmarks;
        }

        console.log(`    [Move] Removing node ${nodeToMove.id} from original position.`);
        const treeWithoutNode = removeNodeById(currentBookmarks, nodeToMove.id);

        console.log(`    [Move] Updating parentId of moved node ${nodeToMove.id} to: ${finalTargetId}`);
        const updatedNodeToMove = { ...nodeToMove, parentId: finalTargetId };

        console.log(`    [Move] Inserting node...`, { node: updatedNodeToMove, position, targetId: finalTargetId });
        const newTree = insertNode(treeWithoutNode, finalTargetId, updatedNodeToMove, position);
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

  const handleAddFolder = useCallback((parentId: string | null) => {
    const folderName = window.prompt("Enter the name for the new folder:", "New Folder");
    if (!folderName || folderName.trim() === "") return;

    const newNode: BookmarkNode = {
      id: uuidv4 ? uuidv4() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: folderName.trim(),
      children: [],
      parentId: parentId
    };
    console.log(`[App] Adding new folder "${newNode.title}" inside parent: ${parentId ?? 'root'}`);
    handleTreeUpdate(currentBookmarks => insertNode(currentBookmarks, parentId, newNode, 'inside'));
  }, [handleTreeUpdate]);

  const handleAddBookmark = useCallback((parentId: string | null) => {
    const title = window.prompt("Enter the bookmark title:", "New Bookmark");
    if (!title || title.trim() === "") return;
    const url = window.prompt("Enter the bookmark URL:");
    if (!url || url.trim() === "") return;
    try { new URL(url.trim()); } catch (_) { alert("Invalid URL."); return; }

    const newBookmark: BookmarkNode = {
      id: uuidv4 ? uuidv4() : `${Date.now()}-${Math.random().toString(16).slice(2)}-bookmark`,
      title: title.trim(),
      url: url.trim(),
      parentId: parentId,
      children: undefined,
    };
    console.log(`[App] Adding new bookmark "${newBookmark.title}" inside parent: ${parentId ?? 'root'}`);
    handleTreeUpdate(currentBookmarks => {
      const position = parentId ? 'inside' : 'root';
      return insertNode(currentBookmarks, parentId, newBookmark, position);
    });
    setTimeout(() => setEditingNodeId(newBookmark.id), 0);
  }, [handleTreeUpdate]);

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
    console.log(`[App:handleRenameNode] Renaming node ${nodeId} to "${newTitle}"`);
    handleTreeUpdate(currentBookmarks => {
      const renameRecursiveMap = (nodes: BookmarkNode[]): BookmarkNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
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
      return renameRecursiveMap(currentBookmarks);
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

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    console.log(`[App] handleUpload: Starting upload for ${file.name}`);
    try {
      setSearchTerm('');
      setSelectedFolderId(ROOT_FOLDER_DROP_ID);
      console.log(`[App] handleUpload: Parsing file ${file.name}...`);
      const parsedBookmarks = await parseBookmarkFile(file);
      console.log(`[App] handleUpload: Received ${parsedBookmarks.length} top-level nodes from parser.`);
      handleTreeUpdate(parsedBookmarks);
      console.log('[App] handleUpload: Upload finished.');
    } catch (err: any) {
      console.error('[App] handleUpload: Error during upload/parse:', err);
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
      handleTreeUpdate([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedFolderContent = useMemo(() => {
    console.log(`[App] Calculating selectedFolderContent for ID: ${selectedFolderId}`);
    if (selectedFolderId === ROOT_FOLDER_DROP_ID) {
      const rootBookmarks = bookmarks.filter(node => node.children === undefined);
      console.log(`[App] Root selected. Found ${rootBookmarks.length} root bookmarks.`);
      return rootBookmarks;
    } else if (selectedFolderId) {
      const folder = findNodeById(bookmarks, selectedFolderId);
      if (folder && folder.children) {
        const folderBookmarks = folder.children.filter(node => node.children === undefined);
        console.log(`[App] Folder ${selectedFolderId} selected. Found folder: ${folder.title}. Returning ${folderBookmarks.length} bookmark children.`);
        return folderBookmarks;
      } else {
        console.warn(`[App] Selected folder ${selectedFolderId} not found or has no children.`);
        return [];
      }
    }
    console.log(`[App] No folder ID selected or invalid. Returning empty array.`);
    return [];
  }, [bookmarks, selectedFolderId]);

  const folderTree = useMemo(() => {
    console.log('[App] Recalculating folderTree...');
    return extractFolderTree(bookmarks);
  }, [bookmarks]);

  const rightPanelNodes = useMemo(() => {
    console.log('[App] Recalculating rightPanelNodes...');
    const children = selectedFolderId === ROOT_FOLDER_DROP_ID
      ? bookmarks
      : findNodeById(bookmarks, selectedFolderId ?? '')?.children;
    const bookmarkItemsOnly = (children || []).filter(node => node.url !== undefined && node.url !== null);
    console.log(`[App] Bookmark items for right panel (FolderID: ${selectedFolderId}):`, bookmarkItemsOnly.length);
    return bookmarkItemsOnly;
  }, [bookmarks, selectedFolderId]);

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
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-6xl w-full h-[80vh] flex flex-col">
          <h1 className="text-2xl font-bold text-center mb-4 flex-shrink-0">Zenmark</h1>

          <div className="mb-4 flex space-x-4 flex-shrink-0">
            <FileUpload
              onUpload={handleFileUpload}
              onClearData={handleClearData}
              hasData={bookmarks.length > 0}
              nodeCounts={nodeCounts}
            />
            {error && <p className="error-message text-red-600">Error: {error}</p>}
            <div className="flex-grow">
              <SearchBar query={searchTerm} onQueryChange={handleSearch} />
            </div>
            <div className="flex items-center space-x-2">
              {duplicateIds.size > 0 && (
                <button
                  onClick={handleRemoveDuplicates}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm"
                  title={`Remove all ${duplicateIds.size} duplicate bookmark entries`}
                >
                  Remove Duplicates ({duplicateIds.size})
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={bookmarks.length === 0}
                className={`bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm ${bookmarks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Export Bookmarks
              </button>
            </div>
          </div>

          <div className="flex flex-grow min-h-0">
            <div className="w-1/3 max-w-xs flex-shrink-0 h-full">
              <FolderTreePanel
                folderTree={folderTree}
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
                searchQuery={searchTerm}
                onDeleteNode={handleDeleteNode}
                onEditNode={setEditingNodeId}
                onAddFolder={handleAddFolder}
                onAddBookmark={handleAddBookmark}
                editingNodeId={editingNodeId}
                handleRenameNode={handleRenameNode}
              />
            </div>

            <div className="flex-grow h-full min-w-0">
              <div className="flex-grow overflow-auto">
                <BookmarkListPanel
                  bookmarkNodes={rightPanelNodes}
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
    </DndContext>
  );
};

export default App;