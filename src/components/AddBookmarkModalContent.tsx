import React, { useState } from 'react';

interface AddBookmarkModalContentProps {
    onCancel: () => void;
    onSubmit: (title: string, url: string) => void;
}

const AddBookmarkModalContent: React.FC<AddBookmarkModalContentProps> = ({ onCancel, onSubmit }) => {
    const [title, setTitle] = useState('New Bookmark');
    const [url, setUrl] = useState('https://');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim() && url.trim()) {
            // Basic URL validation
            try {
                new URL(url.trim());
                onSubmit(title.trim(), url.trim());
            } catch (_) {
                alert('Invalid URL format. Please enter a valid URL (e.g., https://example.com).');
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} id="add-bookmark-form" className="space-y-4">
            <div>
                <label htmlFor="bookmarkTitle" className="block text-sm font-medium text-gray-700 mb-1">
                    Bookmark Title:
                </label>
                <input
                    type="text"
                    id="bookmarkTitle"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                    autoFocus
                    onFocus={(e) => e.target.select()}
                />
            </div>
            <div>
                <label htmlFor="bookmarkUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    URL:
                </label>
                <input
                    type="url" // Use type="url" for basic browser validation
                    id="bookmarkUrl"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                    placeholder="https://example.com"
                />
            </div>
            {/* Render buttons via footer prop in Modal */}
        </form>
    );
};

export default AddBookmarkModalContent; 