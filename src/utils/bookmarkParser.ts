import { BookmarkNode } from '../types/bookmark';

const MAX_BOOKMARKS = 11000; // Temporarily increase limit for testing

// Custom error for exceeding the limit
export class BookmarkLimitExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BookmarkLimitExceededError';
    }
}

/**
 * Parses a Chrome bookmark HTML file content into a tree structure.
 *
 * @param {string} htmlContent - The HTML content of the bookmark file.
 * @returns {BookmarkNode[]} An array of root bookmark nodes.
 * @throws {Error} If the HTML content cannot be parsed, the structure is invalid, or the limit is exceeded.
 */
const parseBookmarkHtml = (htmlContent: string): BookmarkNode[] => {
    console.log('[parseBookmarkHtml] Starting DOM parsing...');
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const counter = { count: 0 }; // Initialize counter object
    console.log('[parseBookmarkHtml] DOM parsing complete.');

    const mainDl = doc.querySelector('body > dl');
    if (mainDl instanceof HTMLDListElement) {
        console.log('[parseBookmarkHtml] Found main DL, starting recursive parse...');
        try {
            const result = parseDl(mainDl, counter, null);
            console.log(`[parseBookmarkHtml] Recursive parse complete. Total items processed: ${counter.count}`);
            return result;
        } catch (error) {
            // Ensure errors from parseDl are re-thrown
            console.error('[parseBookmarkHtml] Error during recursive parse:', error);
            throw error;
        }
    }

    const fallbackDl = doc.querySelector('dl');
    if (fallbackDl instanceof HTMLDListElement) {
        console.warn("[parseBookmarkHtml] Using fallback DL, starting recursive parse...");
        try {
            const result = parseDl(fallbackDl, counter, null);
            console.log(`[parseBookmarkHtml] Fallback recursive parse complete. Total items processed: ${counter.count}`);
            return result;
        } catch (error) {
            // Ensure errors from parseDl are re-thrown
            console.error('[parseBookmarkHtml] Error during fallback recursive parse:', error);
            throw error;
        }
    }

    console.error("[parseBookmarkHtml] Could not find a valid <DL> element.");
    throw new Error("Could not find a valid <DL> element in the bookmark file."); // Throw error instead of returning empty
};

/**
 * Recursively parses a <DL> element and its children elements (<DT>, <DL>)
 * into an array of BookmarkNode objects, respecting the bookmark limit.
 * Handles the sibling relationship between folder <DT>s and their nested <DL>s.
 *
 * @param {HTMLDListElement} dlElement - The <DL> element to parse.
 * @param {{ count: number }} counter - An object to track the total count of nodes parsed.
 * @returns {BookmarkNode[]} An array of bookmark nodes parsed from the DL.
 * @throws {BookmarkLimitExceededError} If the total number of nodes exceeds MAX_BOOKMARKS.
 */
const parseDl = (dlElement: HTMLDListElement, counter: { count: number }, parentId: string | null): BookmarkNode[] => {
    const nodes: BookmarkNode[] = [];
    const children = Array.from(dlElement.children);
    let idCounter = 0;
    console.log(`[parseDl] Processing <DL> with ${children.length} child elements.`);

    // Use a standard for loop to manage index explicitly
    for (let i = 0; i < children.length; i++) {
        const element = children[i];

        // Skip non-DT elements. Also skip <P> tags which Chrome sometimes inserts.
        if (!(element instanceof HTMLElement) || (element.nodeName !== 'DT' && element.nodeName !== 'P')) {
            console.log(`  [parseDl] Skipping non-DT/P element at index ${i}:`, element.nodeName);
            continue;
        }
        // Skip <P> tags specifically
        if (element.nodeName === 'P') {
            console.log(`  [parseDl] Skipping P element at index ${i}.`);
            continue;
        }

        // It IS a DT element
        const dtElement = element as HTMLDListElement; // Use dtElement for clarity
        if (counter.count >= MAX_BOOKMARKS) {
            throw new BookmarkLimitExceededError(`Bookmark limit of ${MAX_BOOKMARKS} exceeded during parsing.`);
        }

        const anchor = dtElement.querySelector<HTMLAnchorElement>(':scope > A');
        const header = dtElement.querySelector<HTMLHeadingElement>(':scope > H3');
        const nodeId = `${Date.now()}-${Math.random().toString(16).slice(2)}-${idCounter++}`;
        counter.count++;
        let newNode: BookmarkNode | null = null;

        if (anchor) {
            // Bookmark Link
            console.log(`  [parseDl] Processing Bookmark Link: \"${anchor.textContent?.trim()}\" at index ${i}`);
            newNode = { id: nodeId, title: anchor.textContent?.trim() || 'Untitled Bookmark', url: anchor.getAttribute('href') || undefined, parentId: parentId };
        } else if (header) {
            // Folder
            const folderTitle = header.textContent?.trim() || 'Untitled Folder';
            console.log(`  [parseDl] Processing Folder DT: \"${folderTitle}\" at index ${i}`);

            // --- Look for a DL child WITHIN the current DT element --- START ---
            let nestedDl: HTMLDListElement | null = null;

            // Use querySelector to find a direct child DL
            const potentialDl = dtElement.querySelector<HTMLDListElement>(':scope > dl');

            if (potentialDl) {
                nestedDl = potentialDl;
                console.log(`    [parseDl] Found child DL within DT for \"${folderTitle}\". Parsing recursively.`);
            } else {
                console.warn(`    [parseDl] No child DL found within DT for folder \"${folderTitle}\". Creating empty folder.`);
                console.warn(`      DT OuterHTML (trimmed):`, dtElement.outerHTML?.substring(0, 200));
            }
            // --- Look for a DL child WITHIN the current DT element --- END ---

            // Recursively parse the nested DL if found, otherwise children is empty
            const childNodes = nestedDl ? parseDl(nestedDl, counter, nodeId) : [];
            newNode = { id: nodeId, title: folderTitle, children: childNodes, parentId: parentId };

        } else {
            // Unrecognized DT structure (neither anchor nor header found within DT)
            console.warn(`  [parseDl] Skipping unrecognized DT structure at index ${i}:`, dtElement.innerHTML);
            counter.count--; // Decrement count as we didn't create a node
        }

        if (newNode) {
            nodes.push(newNode);
        }
    }

    console.log(`[parseDl] Finished processing <DL>. Returning ${nodes.length} nodes.`);
    return nodes;
};

/**
 * Reads a File object representing a Chrome bookmark HTML file
 * and parses it into a bookmark tree.
 *
 * @param {File} file - The bookmark HTML file selected by the user.
 * @returns {Promise<BookmarkNode[]>} A promise that resolves with the array of root bookmark nodes.
 * @rejects {Error} If the file cannot be read, parsed, or exceeds the bookmark limit.
 */
export const parseBookmarkFile = (file: File): Promise<BookmarkNode[]> => {
    return new Promise((resolve, reject) => {
        console.log(`[parseBookmarkFile] Reading file: ${file.name}`);
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                console.log('[parseBookmarkFile] File read complete.');
                const htmlContent = event.target?.result as string;
                if (!htmlContent) {
                    throw new Error('File content is empty or could not be read.');
                }
                // Call parseBookmarkHtml which now throws on error
                const bookmarks = parseBookmarkHtml(htmlContent);
                console.log(`[parseBookmarkFile] Parsing successful. Resolved with ${countBookmarks(bookmarks)} total nodes.`);
                resolve(bookmarks);
            } catch (error) {
                console.error('[parseBookmarkFile] Error during file load or parsing:', error);
                // Reject the promise with the specific error
                reject(error);
            }
        };

        reader.onerror = (event) => {
            console.error('[parseBookmarkFile] FileReader error:', event.target?.error);
            reject(new Error(`Failed to read file: ${event.target?.error?.message || 'Unknown error'}`));
        };

        reader.readAsText(file);
    });
};

// Helper function to count total bookmarks (nodes) in a tree
const countBookmarks = (nodes: BookmarkNode[]): number => {
    let count = 0;
    for (const node of nodes) {
        count++; // Count the node itself
        if (node.children) {
            count += countBookmarks(node.children); // Recursively count children
        }
    }
    return count;
};

// --- Bookmark Export ---

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
            // Note: Chrome export format might include ADD_DATE, LAST_MODIFIED - omitting for simplicity based on PRD
        } else if (node.children) { // It's a folder
            html += `${indent}<DT><H3>${escapeHtml(node.title)}</H3></DT>\n`;
            html += `${indent}<DL><p>\n`;
            html += generateDtElements(node.children, indentLevel + 1); // Recurse for children
            html += `${indent}</DL><p>\n`;
        } else {
            // Handle potential empty folders that might exist in the data structure
            // Although the parser above tries to avoid creating folders without children unless they are explicitly empty
            html += `${indent}<DT><H3>${escapeHtml(node.title)}</H3></DT>\n`;
            html += `${indent}<DL><p>\n`;
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

    let body = '<DL><p>\n'; // Start the main list
    body += generateDtElements(bookmarks, 1); // Start generation with indent level 1
    body += '</DL><p>\n'; // Close the main list

    return header + body;
};