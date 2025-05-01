import React, { ChangeEvent } from 'react';
import { BookmarkNode } from '../types/bookmark'; // Use the correct type definition
import { parseBookmarkFile } from '../utils/bookmarkParser';

/** File upload component for importing Chrome bookmark HTML */
interface FileUploadProps {
    onUpload: (bookmarks: BookmarkNode[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUpload }) => {
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                console.log('Parsing file:', file.name);
                const bookmarks = await parseBookmarkFile(file);
                console.log('Parsed bookmarks:', bookmarks);
                onUpload(bookmarks);
            } catch (error) {
                console.error('File upload error:', error);
                // TODO: Add user-facing error handling (e.g., state update, notification)
            }
        }
    };

    return (
        <div className="mb-4">
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
                Upload Bookmark File (.html)
            </label>
            <input
                id="file-upload"
                name="file-upload"
                type="file"
                accept=".html" // Specify accepted file type
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
        </div>
    );
};

export default FileUpload;
