import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { BookmarkNode } from '../types/bookmark'; // Keep this if needed elsewhere, or remove

/** File upload component for importing Chrome bookmark HTML */
interface FileUploadProps {
    onUpload: (file: File) => void; // Changed to expect a File object
    onClearData: () => void;
    hasData: boolean;
    uploadedFileName: string | null;
    nodeCounts: { total: number, folders: number, bookmarks: number } | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUpload, onClearData, hasData, uploadedFileName, nodeCounts }) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            console.log(`[FileUpload] File selected: ${file.name}, type: ${file.type}`);
            if (file.type === 'text/html') {
                onUpload(file); // Pass the File object directly
            } else {
                alert('Invalid file type. Please upload an HTML bookmark file.');
            }
        }
    }, [onUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'text/html': ['.html'] },
        multiple: false
    });

    return (
        <div className="flex items-center space-x-2">
            <div {...getRootProps()} className={`p-2 border-2 border-dashed rounded cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-100' : 'border-gray-300'}`}>
                <input {...getInputProps()} />
                <p className="text-sm text-gray-600">
                    {isDragActive ? 'Drop the file here ...' : 'Drag & drop bookmark file, or click'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                    (Max: 10,000 bookmarks)
                </p>
            </div>
            {hasData && uploadedFileName && (
                <div className="flex flex-col items-start">
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700 truncate" title={uploadedFileName}>File: {uploadedFileName}</span>
                        <button
                            onClick={onClearData}
                            className="px-2 py-1 text-xs text-red-700 bg-red-100 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                            title="Clear uploaded data"
                        >
                            Clear
                        </button>
                    </div>
                    {nodeCounts && (
                        <div className="text-xs text-gray-500 mt-1">
                            <span>Total: {nodeCounts.total} | </span>
                            <span>Folders: {nodeCounts.folders} | </span>
                            <span>Bookmarks: {nodeCounts.bookmarks}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FileUpload;
