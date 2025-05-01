import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import FileUpload from './components/FileUpload';
import BookmarkTree from './components/BookmarkTree';
import { BookmarkNode } from './types/bookmark';
import { loadBookmarks, saveBookmarks } from './utils/bookmarkStorage';
import { findNodeById, removeNodeById, insertNode } from './utils/treeUtils';

/** Root component for Zenmark web app */
const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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

    if (!over || !active.data.current || active.id === over.id) {
      console.log('Drag cancelled or invalid.');
      return;
    }

    const activeNode = active.data.current.node as BookmarkNode;
    const overNodeId = over.id as string;

    console.log(`Drag End: Item ${activeNode.id} (${activeNode.title}) dropped over ${overNodeId}`);

    setBookmarks((currentBookmarks) => {
      // 1. Find the node being dragged (we already have it in active.data.current.node)
      const nodeToMove = activeNode;

      // 2. Remove the node from its original position
      const treeWithoutNode = removeNodeById(currentBookmarks, nodeToMove.id);

      // 3. Determine insertion position (simple approach: insert inside folders, otherwise insert after)
      // More complex logic could check proximity to top/bottom edges for before/after
      const targetNode = findNodeById(treeWithoutNode, overNodeId); // Find target in the modified tree
      let position: 'inside' | 'after' = 'after'; // Default to inserting after
      let finalTargetId = overNodeId;

      if (targetNode?.children) { // If the target is a folder
        position = 'inside';
      }

      // Prevent dropping a folder inside itself or its descendants (basic check)
      if (position === 'inside' && targetNode && findNodeById([nodeToMove], targetNode.id)) {
        console.warn("Cannot drop a folder inside itself or its descendants.");
        return currentBookmarks; // Revert to original state
      }

      // 4. Insert the node into the new position
      const newTree = insertNode(treeWithoutNode, finalTargetId, nodeToMove, position);

      return newTree;
    });
  };
  // --- End DND Setup ---

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

  useEffect(() => {
    if (isInitialLoad || isLoading) {
      return;
    }
    const saveData = async () => {
      try {
        console.log("Attempting to save bookmarks to IndexedDB...");
        await saveBookmarks(bookmarks);
        console.log("Bookmarks saved successfully.");
      } catch (error) {
        console.error("Failed to save bookmarks to IndexedDB:", error);
      }
    };
    saveData();
  }, [bookmarks, isInitialLoad, isLoading]);

  const handleUpload = (newBookmarks: BookmarkNode[]) => {
    console.log('Handling upload...');
    setBookmarks(newBookmarks);
  };

  const handleExport = () => {
    console.log('Export button clicked');
    // TODO: Add export logic
  };

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
        <div className="bg-white shadow-md rounded-lg p-8 max-w-4xl w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Zenmark</h1>
          <FileUpload onUpload={handleUpload} />

          <BookmarkTree bookmarks={bookmarks} onDeleteNode={handleDeleteNode} />

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleExport}
              disabled={bookmarks.length === 0}
              className={`bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${bookmarks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              type="button"
            >
              Export Bookmarks
            </button>
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export default App;