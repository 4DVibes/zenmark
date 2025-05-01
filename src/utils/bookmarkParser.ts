import { BookmarkNode } from '../types/bookmark';

/**
 * Parses a Chrome bookmark HTML file content into a tree structure.
 * 
 * @param {string} htmlContent - The HTML content of the bookmark file.
 * @returns {BookmarkNode[]} An array of root bookmark nodes.
 * @throws {Error} If the HTML content cannot be parsed or the structure is invalid.
 */
const parseBookmarkHtml = (htmlContent: string): BookmarkNode[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    const mainDl = doc.querySelector('body > dl');
    if (mainDl instanceof HTMLDListElement) {
        return parseDl(mainDl);
    }

    const fallbackDl = doc.querySelector('dl');
    if (fallbackDl instanceof HTMLDListElement) {
        console.warn("Main <DL> not found directly under <BODY>, using first <DL> found.");
        return parseDl(fallbackDl);
    }

    console.error("Could not find a valid <DL> element in the bookmark file.");
    return [];
};

/**
 * Recursively parses a <DL> element and its children (<DT> elements)
 * into an array of BookmarkNode objects.
 * 
 * @param {HTMLDListElement} dlElement - The <DL> element to parse.
 * @returns {BookmarkNode[]} An array of bookmark nodes parsed from the DL.
 */
const parseDl = (dlElement: HTMLDListElement): BookmarkNode[] => {
    const nodes: BookmarkNode[] = [];
    const children = dlElement.querySelectorAll(':scope > dt');
    let idCounter = 0;

    children.forEach((dt) => {
        const anchor = dt.querySelector<HTMLAnchorElement>(':scope > a');
        const header = dt.querySelector<HTMLHeadingElement>(':scope > h3');
        const nestedDl = dt.querySelector<HTMLDListElement>(':scope > dl');

        const nodeId = `${Date.now()}-${Math.random().toString(16).slice(2)}-${idCounter++}`;

        if (anchor) {
            nodes.push({
                id: nodeId,
                title: anchor.textContent?.trim() || 'Untitled Bookmark',
                url: anchor.getAttribute('href') || undefined,
            });
        } else if (header && nestedDl) {
            nodes.push({
                id: nodeId,
                title: header.textContent?.trim() || 'Untitled Folder',
                children: parseDl(nestedDl),
            });
        } else if (header) {
            nodes.push({
                id: nodeId,
                title: header.textContent?.trim() || 'Untitled Folder',
                children: [],
            });
        }
    });

    return nodes;
};

/**
 * Reads a File object representing a Chrome bookmark HTML file 
 * and parses it into a bookmark tree.
 * 
 * @param {File} file - The bookmark HTML file selected by the user.
 * @returns {Promise<BookmarkNode[]>} A promise that resolves with the array of root bookmark nodes.
 * @rejects {Error} If the file cannot be read or parsed.
 */
export const parseBookmarkFile = (file: File): Promise<BookmarkNode[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const htmlContent = event.target?.result as string;
                if (!htmlContent) {
                    throw new Error('File content is empty or could not be read.');
                }
                const bookmarks = parseBookmarkHtml(htmlContent);
                resolve(bookmarks);
            } catch (error) {
                console.error('Error parsing bookmark file:', error);
                reject(new Error(`Failed to parse bookmark file: ${error instanceof Error ? error.message : String(error)}`));
            }
        };

        reader.onerror = (event) => {
            console.error('Error reading file:', event.target?.error);
            reject(new Error(`Failed to read file: ${event.target?.error?.message || 'Unknown error'}`));
        };

        reader.readAsText(file);
    });
};