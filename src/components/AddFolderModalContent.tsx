import React, { useState } from 'react';

interface AddFolderModalContentProps {
    onCancel: () => void;
    onSubmit: (folderName: string) => void;
}

const AddFolderModalContent: React.FC<AddFolderModalContentProps> = ({ onCancel, onSubmit }) => {
    const [folderName, setFolderName] = useState('New Folder');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (folderName.trim()) {
            onSubmit(folderName.trim());
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 mb-1">
                Folder Name:
            </label>
            <input
                type="text"
                id="folderName"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                autoFocus
                onFocus={(e) => e.target.select()} // Select text on focus
            />
            {/* Render buttons via footer prop in Modal */}
        </form>
    );
};

export default AddFolderModalContent; 