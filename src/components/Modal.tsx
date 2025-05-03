import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode; // Content of the modal body
    footer?: React.ReactNode; // Optional footer for buttons etc.
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
}) => {
    if (!isOpen) {
        return null;
    }

    return (
        // Backdrop / Overlay
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out"
            onClick={onClose} // Close on backdrop click
        >
            {/* Modal Content */}
            <div
                className="relative w-full max-w-md transform rounded-lg bg-white p-6 shadow-xl transition-all duration-300 ease-in-out"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                {/* Header */}
                <div className="mb-4 flex items-start justify-between border-b border-gray-200 pb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <button
                        type="button"
                        className="ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-4">
                    {children}
                </div>

                {/* Footer (Optional) */}
                {footer && (
                    <div className="mt-6 flex items-center justify-end space-x-3 border-t border-gray-200 pt-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal; 