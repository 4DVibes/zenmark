import React from 'react';

interface SearchBarProps {
    query: string;
    onQueryChange: (query: string) => void;
    placeholder?: string; // Optional placeholder text
}

const SearchBar: React.FC<SearchBarProps> = ({
    query,
    onQueryChange,
    placeholder = "Search all bookmarks..."
}) => {
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onQueryChange(event.target.value);
    };

    const handleClearClick = () => {
        onQueryChange('');
    };

    return (
        <div className="relative w-full my-4"> {/* Container for positioning */}
            <input
                type="text"
                value={query}
                onChange={handleInputChange}
                placeholder={placeholder}
                aria-label="Search bookmarks"
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
            {query && ( // Show clear button only if query is not empty
                <button
                    onClick={handleClearClick}
                    aria-label="Clear search"
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-10 h-full text-gray-500 hover:text-gray-700 focus:outline-none"
                    type="button" // Important for forms
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            )}
        </div>
    );
};

export default SearchBar; 