import { BookmarkNode } from '../types/bookmark';

/**
 * Recursively searches for a node by its ID within a bookmark tree.
 * 
 * @param nodes The array of nodes to search within.
 * @param id The ID of the node to find.
 * @returns The found BookmarkNode or null if not found.
 */
export const findNodeById = (nodes: BookmarkNode[], id: string): BookmarkNode | null => {
    for (const node of nodes) {
        if (node.id === id) {
            return node;
        }
        if (node.children) {
            const foundInChildren = findNodeById(node.children, id);
            if (foundInChildren) {
                return foundInChildren;
            }
        }
    }
    return null;
};

/** Helper to recursively remove a node */
const removeNodeRecursive = (nodes: BookmarkNode[], id: string): BookmarkNode[] => {
    return nodes
        .filter(node => node.id !== id) // Filter out the node at the current level
        .map(node => {
            // If the node has children, recursively attempt removal in its children
            if (node.children) {
                const newChildren = removeNodeRecursive(node.children, id);
                // If children array changed, return a new node object
                if (newChildren !== node.children) {
                    return { ...node, children: newChildren };
                }
            }
            // If no children or children didn't change, return the original node
            return node;
        });
};

/**
 * Removes a node by its ID from a bookmark tree immutably.
 * 
 * @param nodes The current array of nodes.
 * @param id The ID of the node to remove.
 * @returns A new array of nodes with the specified node removed.
 */
export const removeNodeById = (nodes: BookmarkNode[], id: string): BookmarkNode[] => {
    return removeNodeRecursive(nodes, id);
};

/** Helper to recursively insert a node */
const insertNodeRecursive = (
    nodes: BookmarkNode[],
    targetId: string,
    newNode: BookmarkNode,
    position: 'before' | 'after' | 'inside'
): BookmarkNode[] => {
    const newNodes = [...nodes]; // Create a mutable copy for this level
    let inserted = false;

    for (let i = 0; i < newNodes.length; i++) {
        const node = newNodes[i];

        if (node.id === targetId) {
            if (position === 'inside') {
                // Ensure target is a folder (or treat as such)
                const targetNode = { ...node }; // Clone target node
                targetNode.children = targetNode.children ? [...targetNode.children, newNode] : [newNode];
                newNodes[i] = targetNode; // Replace node with updated one
                inserted = true;
            } else if (position === 'before') {
                newNodes.splice(i, 0, newNode); // Insert before target
                inserted = true;
            } else { // position === 'after'
                newNodes.splice(i + 1, 0, newNode); // Insert after target
                inserted = true;
            }
            break; // Exit loop once inserted at this level
        }

        // If not inserted and node has children, try inserting recursively
        if (!inserted && node.children) {
            const updatedChildren = insertNodeRecursive(node.children, targetId, newNode, position);
            // If the children array changed, update the node immutably
            if (updatedChildren !== node.children) {
                newNodes[i] = { ...node, children: updatedChildren };
                inserted = true; // Mark as inserted (within a child)
                break; // Exit loop, insertion happened deeper
            }
        }
    }

    // If inserted is true, return the modified array (or the result of the recursive call)
    // If inserted is false, it means targetId wasn't found at this level or below, return original (reference)
    return inserted ? newNodes : nodes;
};


/**
 * Inserts a node into a bookmark tree immutably.
 * Can insert relative to a target node (before/after) or inside a target folder.
 * 
 * @param nodes The current array of nodes.
 * @param targetId The ID of the node to insert relative to. Can be null for root insertion.
 * @param newNode The node to insert.
 * @param position 'before', 'after', or 'inside' (if target is a folder). 'root' for top level.
 * @returns A new array of nodes with the newNode inserted.
 */
export const insertNode = (
    nodes: BookmarkNode[],
    targetId: string | null, // Allow null targetId for root insertion
    newNode: BookmarkNode,
    position: 'before' | 'after' | 'inside' | 'root' // Add 'root' position
): BookmarkNode[] => {
    if (position === 'root' || targetId === null) {
        // Insert at the beginning of the root level for simplicity
        // Could add logic for specific root index if needed
        return [newNode, ...nodes];
    }
    return insertNodeRecursive(nodes, targetId, newNode, position);
};


// --- Find Parent Info (Potentially useful for more complex logic later) ---
/**
 * Finds the parent node and the index of a child node within a tree.
 * 
 * @param nodes The array of nodes representing the tree or subtree.
 * @param childId The ID of the child node whose parent is needed.
 * @returns An object containing the parent node and the index of the child, 
 *          or null if the node is at the root or not found.
 *          { parent: BookmarkNode | null (null for root level), index: number }
 */
export const findParentInfo = (
    nodes: BookmarkNode[],
    childId: string,
    currentParent: BookmarkNode | null = null // Keep track of parent during recursion
): { parent: BookmarkNode | null; index: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.id === childId) {
            return { parent: currentParent, index: i };
        }
        if (node.children) {
            const found = findParentInfo(node.children, childId, node); // Pass current node as parent
            if (found) {
                return found;
            }
        }
    }
    return null;
}; 