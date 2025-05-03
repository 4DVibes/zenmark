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