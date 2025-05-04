import { BookmarkNode, FlattenedBookmarkNode } from '../types/bookmark';

/**
 * Recursively searches for a node by its ID within a bookmark tree.
 * 
 * @param nodes The array of nodes to search within.
 * @param id The ID of the node to find.
 * @returns The found BookmarkNode or null if not found.
 */
export const findNodeById = (nodes: BookmarkNode[], id: string, _depth = 0): BookmarkNode | null => {
    const indent = '  '.repeat(_depth);
    console.log(`${indent}[findNodeById] Searching ${nodes.length} nodes at depth ${_depth} for ID: ${id}`);
    for (const node of nodes) {
        console.log(`${indent}  Checking node ID: ${node.id} (Type: ${typeof node.id}) against target ID: ${id} (Type: ${typeof id})`); // Detailed check
        if (node.id === id) {
            console.log(`${indent}  FOUND node: ${node.id}`);
            return node;
        }
        // Ensure children is an array before recursing
        if (Array.isArray(node.children) && node.children.length > 0) {
            console.log(`${indent}  Recursing into children of ${node.id}`);
            const foundInChildren = findNodeById(node.children, id, _depth + 1);
            if (foundInChildren) {
                console.log(`${indent}  Found in children of ${node.id}, returning up.`);
                return foundInChildren;
            } else {
                console.log(`${indent}  Not found in children of ${node.id}.`);
            }
        }
    }
    console.log(`${indent}[findNodeById] ID ${id} not found at depth ${_depth}.`);
    return null;
};

/** Helper to recursively remove a node ensuring immutability */
const removeNodeRecursive = (nodes: BookmarkNode[], id: string): { tree: BookmarkNode[], removed: boolean } => {
    let treeCopy: BookmarkNode[] | null = null;
    let removed = false;
    const resultNodes: BookmarkNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (node.id === id) {
            // Node found at this level, mark as removed and *don't* add it to resultNodes
            if (treeCopy === null) treeCopy = nodes.slice(0, i); // Copy preceding nodes if needed
            removed = true;
            // Skip adding this node
        } else {
            let processedNode = node; // Start with the original node reference
            // If node has children, try removing recursively
            if (node.children) {
                const result = removeNodeRecursive(node.children, id);
                // If removal happened deeper, update the current node immutably
                if (result.removed) {
                    processedNode = { ...node, children: result.tree }; // Create new node object
                    removed = true; // Mark that a removal happened (in children)
                }
            }
            // Add the processed node (either original or updated) to the results
            if (treeCopy !== null) {
                // If we started copying, continue adding to the copy
                treeCopy.push(processedNode);
            } else if (processedNode !== node) {
                // If the node was updated (due to child removal) and we haven't copied yet,
                // copy preceding nodes and add the updated node.
                treeCopy = [...nodes.slice(0, i), processedNode];
            } else {
                // If node wasn't removed or modified, add to result (no copy needed yet)
                resultNodes.push(node);
            }
        }
    }

    // If treeCopy was created, it holds the result. Otherwise, resultNodes holds it (if no changes)
    // The 'removed' flag indicates if any change occurred anywhere in the subtree.
    return { tree: treeCopy ?? resultNodes, removed };
};

/**
 * Removes a node by its ID from a bookmark tree immutably.
 * 
 * @param nodes The current array of nodes.
 * @param id The ID of the node to remove.
 * @returns A new array of nodes with the specified node removed.
 */
export const removeNodeById = (nodes: BookmarkNode[], id: string): BookmarkNode[] => {
    console.log(`[removeNodeById] Attempting to remove: ${id}`);
    const result = removeNodeRecursive(nodes, id);
    if (!result.removed) {
        console.warn(`[removeNodeById] Node with ID "${id}" not found for removal.`);
    }
    // Check if the reference changed when it should have
    if (result.removed && result.tree === nodes) {
        console.error(`[removeNodeById] IMMUTABILITY ERROR: Node was removed but array reference did not change!`);
    }
    if (!result.removed && result.tree !== nodes) {
        console.error(`[removeNodeById] IMMUTABILITY ERROR: Node was not removed but array reference changed!`);
    }
    console.log(`[removeNodeById] Removal result: removed=${result.removed}, ref changed=${result.tree !== nodes}`);
    return result.tree; // Always return the resulting tree (new or original reference)
};

/** Helper to recursively insert a node ensuring immutability */
const insertNodeRecursive = (
    nodes: BookmarkNode[],
    targetId: string,
    newNode: BookmarkNode,
    position: 'before' | 'after' | 'inside'
): { tree: BookmarkNode[], inserted: boolean } => {

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // --- Found Target at Current Level --- 
        if (node.id === targetId) {
            const treeCopy = [...nodes]; // Create copy now
            if (position === 'inside') {
                // Ensure it's a folder; create children array if needed
                // Clone children if they exist, then add newNode
                const newChildren = node.children ? [...node.children, newNode] : [newNode];
                treeCopy[i] = { ...node, children: newChildren }; // Create new node object with new children array
            } else if (position === 'before') {
                treeCopy.splice(i, 0, newNode);
            } else { // 'after'
                treeCopy.splice(i + 1, 0, newNode);
            }
            // Return the modified copy and indicate success
            return { tree: treeCopy, inserted: true };
        }

        // --- Check Children Recursively --- 
        if (node.children) {
            const result = insertNodeRecursive(node.children, targetId, newNode, position);

            // If insertion happened deeper, we MUST create a new copy of the current level array
            // and update the specific child node immutably.
            if (result.inserted) {
                const treeCopy = [...nodes]; // Create copy of current level
                treeCopy[i] = { ...node, children: result.tree }; // Create new parent node object
                // Return the modified copy and indicate success
                return { tree: treeCopy, inserted: true };
            }
        }
    }

    // Target not found at this level or below, return original tree and false
    return { tree: nodes, inserted: false };
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
    targetId: string | null,
    newNode: BookmarkNode,
    position: 'before' | 'after' | 'inside' | 'root'
): BookmarkNode[] => {
    console.log(`[insertNode] Attempting insert relative to ${targetId ?? 'root'} at position ${position}`);
    if (position === 'root' || targetId === null) {
        console.log(`[insertNode] Inserting at root:`, newNode);
        const newTree = [newNode, ...nodes];
        console.log(`[insertNode] Root insert result: ref changed=${newTree !== nodes}`);
        return newTree;
    }

    // Target ID must be a string here for recursive call
    const result = insertNodeRecursive(nodes, targetId, newNode, position as 'before' | 'after' | 'inside');

    if (!result.inserted) {
        console.warn(`[insertNode] Target ID "${targetId}" not found for insertion. Node not inserted.`);
    }
    // Check if the reference changed when it should have
    if (result.inserted && result.tree === nodes) {
        console.error(`[insertNode] IMMUTABILITY ERROR: Node was inserted but array reference did not change!`);
    }
    if (!result.inserted && result.tree !== nodes) {
        console.error(`[insertNode] IMMUTABILITY ERROR: Node was not inserted but array reference changed!`);
    }
    console.log(`[insertNode] Recursive insert result: inserted=${result.inserted}, ref changed=${result.tree !== nodes}`);
    return result.tree; // Return the resulting tree (modified or original)
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

// --- Filtering and Searching ---

export interface FilterResults {
    filteredNodes: BookmarkNode[];
    matchingFolderIds: Set<string>; // IDs of folders containing matches (including ancestors)
}

/**
 * Recursively filters a bookmark tree based on a search query.
 * Matches against title, URL, and notes (case-insensitive).
 * Includes a node if it matches or if any of its descendants match.
 * Also returns a set of folder IDs that contain matches.
 *
 * @param nodes The array of nodes to filter.
 * @param query The search query string.
 * @returns An object containing the filtered nodes and a set of matching folder IDs.
 */
export const filterBookmarkTree = (nodes: BookmarkNode[], query: string): FilterResults => {
    if (!query) {
        return { filteredNodes: nodes, matchingFolderIds: new Set() }; // No filter applied
    }

    const lowerCaseQuery = query.toLowerCase();
    const filteredNodes: BookmarkNode[] = [];
    const matchingFolderIds = new Set<string>(); // Track folders with matches

    for (const node of nodes) {
        const isFolder = !!node.children;

        // Check if the current node matches
        const titleMatch = node.title.toLowerCase().includes(lowerCaseQuery);
        const urlMatch = !isFolder && node.url?.toLowerCase().includes(lowerCaseQuery) || false;
        const notesMatch = node.notes?.toLowerCase().includes(lowerCaseQuery) || false;
        const selfMatch = titleMatch || urlMatch || notesMatch;

        // Recursively check children
        let childrenMatch = false;
        let filteredChildren: BookmarkNode[] = [];
        let childMatchingFolderIds = new Set<string>();

        if (isFolder && node.children) {
            const childResult = filterBookmarkTree(node.children, query);
            filteredChildren = childResult.filteredNodes;
            childMatchingFolderIds = childResult.matchingFolderIds;
            childrenMatch = filteredChildren.length > 0; // Does this folder contain matches?
        }

        // Include the node if it matches or any of its children match
        if (selfMatch || childrenMatch) {
            const resultingChildren = isFolder ? filteredChildren : undefined;
            filteredNodes.push({
                ...node,
                children: resultingChildren
            });

            // If this is a folder and it contains matches (or is a match itself),
            // add its ID and any matching child folder IDs to the set.
            if (isFolder) {
                matchingFolderIds.add(node.id);
                childMatchingFolderIds.forEach(id => matchingFolderIds.add(id));
            }
        }
    }

    return { filteredNodes, matchingFolderIds };
};

/**
 * Traverses the bookmark tree and identifies nodes with duplicate URLs.
 * Only considers nodes with a defined `url` property (i.e., not folders).
 *
 * @param nodes The array of nodes to scan.
 * @returns A Set containing the IDs of all nodes that have duplicate URLs.
 */
export const findDuplicateUrls = (nodes: BookmarkNode[]): Set<string> => {
    const urlMap = new Map<string, string[]>(); // Map<url, list_of_node_ids>
    const duplicateIdSet = new Set<string>();

    const traverse = (nodesToScan: BookmarkNode[]) => {
        for (const node of nodesToScan) {
            if (node.url) {
                const urlKey = node.url;
                const existingIds = urlMap.get(urlKey);
                if (existingIds) {
                    existingIds.push(node.id);
                    existingIds.forEach(id => duplicateIdSet.add(id));
                } else {
                    urlMap.set(urlKey, [node.id]);
                }
            }
            if (node.children) {
                traverse(node.children);
            }
        }
    };

    traverse(nodes);
    return duplicateIdSet;
};

/**
 * Escapes HTML characters in a string.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
const escapeHtml = (str: string): string => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Recursively generates the HTML <DT> elements for bookmarks and folders.
 * @param {BookmarkNode[]} nodes - The nodes to generate HTML for.
 * @param {number} indentLevel - The current indentation level for pretty printing.
 * @returns {string} The generated HTML string snippet.
 */
const generateDtElements = (nodes: BookmarkNode[], indentLevel: number): string => {
    const indent = '    '.repeat(indentLevel);
    let html = '';

    nodes.forEach(node => {
        if (node.url) { // It's a bookmark
            html += `${indent}<DT><A HREF="${escapeHtml(node.url)}">${escapeHtml(node.title)}</A></DT>\n`;
        } else if (node.children) { // It's a folder
            html += `${indent}<DT><H3>${escapeHtml(node.title)}</H3></DT>\n`;
            html += `${indent}<DL><p>\n`;
            html += generateDtElements(node.children, indentLevel + 1); // Recurse
            html += `${indent}</DL><p>\n`;
        }
    });

    return html;
};

/**
 * Generates a Netscape Bookmark File Format HTML string from a bookmark tree.
 * @param {BookmarkNode[]} bookmarks - The array of root bookmark nodes.
 * @returns {string} The complete HTML string for the bookmark file.
 */
export const generateBookmarkHtml = (bookmarks: BookmarkNode[]): string => {
    const header = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
`;

    let body = '<DL><p>\n';
    body += generateDtElements(bookmarks, 1);
    body += '</DL><p>\n';

    return header + body;
};

// --- Tree Flattening for Virtualization ---

/**
 * Flattens a bookmark tree into a list suitable for virtualization,
 * only including children of expanded folders.
 *
 * @param nodes The array of nodes to flatten.
 * @param expandedIds A Set containing the IDs of currently expanded folders.
 * @param currentDepth The current indentation depth (starts at 0).
 * @returns An array of FlattenedBookmarkNode objects.
 */
export const flattenBookmarkTree = (
    nodes: BookmarkNode[],
    expandedIds: Set<string>,
    currentDepth = 0
): FlattenedBookmarkNode[] => {
    const flattenedList: FlattenedBookmarkNode[] = [];

    for (const node of nodes) {
        const isFolder = !!node.children;
        const isExpanded = isFolder && expandedIds.has(node.id);

        // Add the current node to the list
        flattenedList.push({
            id: node.id,
            node: node,
            depth: currentDepth,
            isExpanded: isFolder ? isExpanded : undefined, // Only relevant for folders
        });

        // If it's an expanded folder, recursively add its children
        if (isFolder && isExpanded && node.children) {
            flattenedList.push(
                ...flattenBookmarkTree(node.children, expandedIds, currentDepth + 1)
            );
        }
    }

    return flattenedList;
};

// --- Utilities for Two-Panel Layout ---

/**
 * Recursively extracts only the folder nodes from a bookmark tree.
 * @param nodes The array of nodes to process.
 * @returns A new array containing only folder nodes (maintaining hierarchy).
 */
export const extractFolderTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
    return nodes
        .filter(node => !!node.children) // Keep only nodes that are folders
        .map(folder => ({
            ...folder,
            // Recursively process children to keep only subfolders
            children: folder.children ? extractFolderTree(folder.children) : [],
        }));
};

/**
 * Gets the children of a specific node ID from the full bookmark tree.
 * Returns the root nodes if nodeId is null.
 * @param nodes The full array of root bookmark nodes.
 * @param nodeId The ID of the parent node whose children are needed, or null for root.
 * @returns An array of child nodes, or the root nodes, or an empty array if not found/no children.
 */
export const getNodeChildren = (nodes: BookmarkNode[], nodeId: string | null): BookmarkNode[] => {
    if (nodeId === null) {
        return nodes; // Requesting root nodes
    }

    const parentNode = findNodeById(nodes, nodeId);
    return parentNode?.children || []; // Return children or empty array
};

/**
 * Generates a unique ID for drag-and-drop operations on the root level.
 */
export const ROOT_FOLDER_DROP_ID = '__ROOT__';

/**
 * Counts the total number of nodes, folders, and bookmarks in a tree.
 *
 * @param {BookmarkNode[]} nodes - The array of root bookmark nodes.
 * @returns {{ total: number, folders: number, bookmarks: number }} - An object containing the counts.
 */
export const countNodesByType = (nodes: BookmarkNode[]): { total: number, folders: number, bookmarks: number } => {
    let counts = { total: 0, folders: 0, bookmarks: 0 };

    const traverse = (node: BookmarkNode) => {
        counts.total++;
        if (node.children) { // It's a folder
            counts.folders++;
            node.children.forEach(traverse);
        } else if (node.url) { // It's a bookmark link
            counts.bookmarks++;
        }
        // Nodes that are neither (e.g., separators, if they existed) wouldn't be counted in folders/bookmarks but would be in total
    };

    nodes.forEach(traverse);
    return counts;
};

/** Recursively removes nodes with the given IDs from the tree */
export function removeNodesByIds(tree: BookmarkNode[], idsToRemove: Set<string>): BookmarkNode[] {
    return tree.filter(node => !idsToRemove.has(node.id));
}

/**
 * Recursively adds a new node to the tree under the specified parent ID.
 * Ensures immutability by returning new arrays/objects where changes occur.
 *
 * @param tree The current bookmark tree.
 * @param parentId The ID of the parent node to add the new node under.
 * @param newNode The bookmark node to add.
 * @returns A new tree array with the node added, or null if the parentId was not found.
 */
export function addNodeToTree(
    tree: BookmarkNode[],
    parentId: string,
    newNode: BookmarkNode
): BookmarkNode[] | null {
    let found = false;

    function recurse(nodes: BookmarkNode[]): BookmarkNode[] {
        return nodes.map(node => {
            if (node.id === parentId) {
                found = true;
                // Ensure parent has children array initialized
                const children = node.children ? [...node.children] : [];
                children.push(newNode); // Add the new node
                return {
                    ...node,
                    children: children
                };
            }
            // If node has children, recurse into them
            if (node.children && node.children.length > 0) {
                const updatedChildren = recurse(node.children);
                // If children were updated (found flag set during nested call),
                // return a new node object with the updated children
                if (found && updatedChildren !== node.children) {
                    return { ...node, children: updatedChildren };
                }
            }
            // Return the original node if no changes were made to it or its descendants
            return node;
        });
    }

    const newTree = recurse(tree);

    // Return the new tree if the parent was found, otherwise null
    return found ? newTree : null;
}

/** Creates a map of URL -> Array of BookmarkNode IDs */
export function findDuplicateUrls(tree: BookmarkNode[]): Map<string, string[]> {
    const urlMap = new Map<string, string[]>();

    const traverse = (nodes: BookmarkNode[]) => {
        for (const node of nodes) {
            if (node.url) {
                const urlKey = node.url;
                const existingIds = urlMap.get(urlKey);
                if (existingIds) {
                    existingIds.push(node.id);
                } else {
                    urlMap.set(urlKey, [node.id]);
                }
            }
            if (node.children) {
                traverse(node.children);
            }
        }
    };

    traverse(tree);
    return urlMap;
}