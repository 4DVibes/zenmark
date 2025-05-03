const fs = require('fs');

const FILENAME = 'test-bookmarks.html';
const TARGET_ITEMS = 10000;
const MAX_DEPTH = 5;
const ITEMS_PER_FOLDER = 10;
const FOLDER_CHANCE = 0.1; // 10% chance an item is a folder

let currentId = 0;
let totalItems = 0;

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function generateItems(depth) {
    let html = '';
    const indent = '    '.repeat(depth + 1);
    const itemsInThisFolder = Math.min(ITEMS_PER_FOLDER, TARGET_ITEMS - totalItems);

    for (let i = 0; i < itemsInThisFolder && totalItems < TARGET_ITEMS; i++) {
        totalItems++;
        currentId++;
        const title = `Item ${currentId} (Depth ${depth})`;

        if (depth < MAX_DEPTH && Math.random() < FOLDER_CHANCE) {
            // Create a folder
            html += `${indent}<DT><H3>${escapeHtml(title)}</H3></DT>\n`;
            html += `${indent}<DL><p>\n`;
            html += generateItems(depth + 1); // Recurse
            html += `${indent}</DL><p>\n`;
        } else {
            // Create a bookmark
            const url = `https://example.com/item/${currentId}`;
            html += `${indent}<DT><A HREF="${escapeHtml(url)}">${escapeHtml(title)}</A></DT>\n`;
        }
    }
    return html;
}

console.log(`Generating approximately ${TARGET_ITEMS} bookmarks...`);

let fileContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Generated Test Bookmarks</H1>
<DL><p>
`;

// Generate the main structure until target is reached
while (totalItems < TARGET_ITEMS) {
    fileContent += generateItems(0);
    // Add a top-level folder if needed to contain more items
    if (totalItems < TARGET_ITEMS) {
        totalItems++;
        currentId++;
        const title = `Folder Group ${currentId}`;
        fileContent += `    <DT><H3>${escapeHtml(title)}</H3></DT>\n`;
        fileContent += `    <DL><p>\n`;
        // generateItems will be called again in the next loop iteration
    } else {
        // If target reached within generateItems, close the last group if opened
        if (fileContent.endsWith('<DL><p>\n')) {
             fileContent += '    </DL><p>\n';
        }
    }
}

// Ensure any opened DLs are closed
let openDL = (fileContent.match(/<DL>/g) || []).length;
let closeDL = (fileContent.match(/<\/DL>/g) || []).length;
while (openDL > closeDL) {
    fileContent += '</DL><p>\n';
    closeDL++;
}

fs.writeFileSync(FILENAME, fileContent);

console.log(`Successfully generated ${totalItems} items in ${FILENAME}`); 