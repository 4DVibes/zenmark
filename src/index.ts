import * as fs from 'fs';
import { marked } from 'marked';

// Main entry point for ZenMark

console.log('Hello from ZenMark!');

// Function to read and parse a Markdown file
function parseMarkdownFile(filePath: string): string | Promise<string> {
    try {
        const markdown = fs.readFileSync(filePath, 'utf-8');
        return marked.parse(markdown);
    } catch (error) {
        console.error('Error reading or parsing Markdown file:', error);
        throw error; // Rethrow or handle as needed
    }
}

// Example usage: Replace 'example.md' with your actual Markdown file path
const sampleFilePath = 'example.md';

// Create a dummy example.md for testing
if (!fs.existsSync(sampleFilePath)) {
    fs.writeFileSync(sampleFilePath, '# Hello ZenMark\n\nThis is a *sample* Markdown file.');
    console.log(`Created dummy file: ${sampleFilePath}`);
}


try {
    const htmlOutput = parseMarkdownFile(sampleFilePath);
    console.log('\n--- Parsed HTML Output ---\n');
    console.log(htmlOutput);
    console.log('\n--------------------------\n');
} catch (error) {
    // Error already logged in parseMarkdownFile
    process.exit(1); // Exit if parsing failed
} 