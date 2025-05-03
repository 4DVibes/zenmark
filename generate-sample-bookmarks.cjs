const fs = require('fs');

const NUM_FOLDERS = 20;
const BOOKMARKS_PER_FOLDER = 10; // Approx 200 total bookmarks
const MAX_NESTING_DEPTH = 3;
const FILE_NAME = 'sample-bookmarks.html';

let bookmarkIdCounter = 0;

/**
 * Escapes HTML characters in a string.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
const escapeHtml = (str) => {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Generates a bookmark node HTML string.
 * @param {string} title - Bookmark title.
 * @param {string} url - Bookmark URL.
 * @param {number} indentLevel - Indentation level.
 * @returns {string} HTML string for the bookmark.
 */
const generateBookmarkHtml = (title, url, indentLevel) => {
    const indent = '    '.repeat(indentLevel);
    // Simulate Chrome's ADD_DATE and LAST_MODIFIED (optional, but common)
    const timestamp = Math.floor(Date.now() / 1000);
    return `${indent}<DT><A HREF="${escapeHtml(url)}" ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${escapeHtml(title)}</A></DT>\n`;
};

/**
 * Generates a folder structure HTML string recursively.
 * @param {string} folderTitle - Title of the folder.
 * @param {number} currentDepth - Current nesting depth.
 * @param {number} indentLevel - Indentation level.
 * @returns {string} HTML string for the folder and its contents.
 */
const generateFolderHtml = (folderTitle, currentDepth, indentLevel) => {
    const indent = '    '.repeat(indentLevel);
    let html = `${indent}<DT><H3>${escapeHtml(folderTitle)}</H3></DT>\n`;
    html += `${indent}<DL><p>\n`; // Start folder content

    // Add bookmarks to this folder
    for (let i = 0; i < BOOKMARKS_PER_FOLDER; i++) {
        bookmarkIdCounter++;
        const bookmarkTitle = `Bookmark ${bookmarkIdCounter} in ${folderTitle}`;
        const url = `https://example.com/bookmark/${bookmarkIdCounter}`;
        html += generateBookmarkHtml(bookmarkTitle, url, indentLevel + 1);
    }

    // Potentially add a nested folder (reduce chance with depth)
    if (currentDepth < MAX_NESTING_DEPTH && Math.random() < 0.3 / (currentDepth + 1)) {
         const nestedFolderTitle = `${folderTitle} - Subfolder ${currentDepth + 1}`;
         html += generateFolderHtml(nestedFolderTitle, currentDepth + 1, indentLevel + 1);
    }


    html += `${indent}</DL><p>\n`; // End folder content
    return html;
};

// --- Main Generation Logic ---

console.log(`Generating ${FILE_NAME}...`);

let outputHtml = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

// Create top-level folders
for (let i = 1; i <= NUM_FOLDERS; i++) {
    const folderTitle = `Sample Folder ${i}`;
    // Start folders at depth 0, indent level 1
    outputHtml += generateFolderHtml(folderTitle, 0, 1);
}

// Add a few top-level bookmarks for variety
for (let i = 0; i < 5; i++) {
     bookmarkIdCounter++;
     const bookmarkTitle = `Top Level Bookmark ${bookmarkIdCounter}`;
     const url = `https://example.com/top/${bookmarkIdCounter}`;
     outputHtml += generateBookmarkHtml(bookmarkTitle, url, 1); // Indent level 1
}


outputHtml += `</DL><p>\n`; // Close main DL

fs.writeFile(FILE_NAME, outputHtml, (err) => {
    if (err) {
        console.error(`Error writing file ${FILE_NAME}:`, err);
    } else {
        console.log(`${FILE_NAME} created successfully with approximately ${bookmarkIdCounter} bookmarks.`);
        console.log(`Total lines: ${outputHtml.split('\n').length}`);

    }
}); 