import React from 'react';
import { Menu, Item, Separator } from 'react-contexify';
import { FOLDER_MENU_ID } from '../App'; // Import the ID

// Interface for the props passed *from* the trigger (FolderRow or background)
interface FolderTriggerProps {
    nodeId: string | null; // The ID of the folder right-clicked (null for root/background)
    parentId?: string | null; // Added for consistency, might not be needed here yet
    // Use the names passed by FolderRow
    onAddFolder: (parentId: string | null) => void;
    onAddBookmark: (parentId: string | null) => void;
    onEdit: () => void; // Changed from onEditNode
    onDelete: () => void; // Changed from onDeleteNode
}

const FolderContextMenu: React.FC = () => {
    const handleItemClick = ({ id, props }: { id?: string, props?: FolderTriggerProps }) => {
        console.log(`[FolderContextMenu] handleItemClick: id=${id}, propsNodeId=${props?.nodeId}`);
        if (!props) return;

        // Handle actions based on the menu item ID
        switch (id) {
            // --- Actions for specific folders (nodeId is not null) ---
            case 'add-folder':
                if (props.nodeId) props.onAddFolder(props.nodeId);
                break;
            case 'add-bookmark':
                if (props.nodeId) props.onAddBookmark(props.nodeId);
                break;
            case 'edit':
                if (props.nodeId && props.onEdit) {
                    props.onEdit(); // Call the passed function
                } else {
                    console.error('onEdit handler or nodeId missing for folder edit');
                }
                break;
            case 'delete':
                if (props.nodeId && props.onDelete) {
                    props.onDelete(); // Call the passed function
                } else {
                    console.error('onDelete handler or nodeId missing for folder delete');
                }
                break;
            // --- Actions for root/background (nodeId is null) ---
            case 'add-folder-root':
                props.onAddFolder(null); // Add folder to root
                break;
            case 'add-bookmark-root':
                props.onAddBookmark(null); // Add bookmark to root
                break;
            default:
                console.warn(`Unknown context menu item clicked: ${id}`);
        }
    };

    // Determine which items to show based on whether a specific folder node was clicked
    // (We can refine this later if needed, maybe using predicate in react-contexify)
    return (
        <Menu id={FOLDER_MENU_ID}>
            {/* Generic Add Folder (context determines target) */}
            <Item id="add-folder" onClick={handleItemClick}>Add Folder Inside</Item>
            <Item id="add-bookmark" onClick={handleItemClick}>Add Bookmark Inside</Item>
            <Separator />
            <Item id="edit" onClick={handleItemClick}>Rename</Item>
            <Item id="delete" onClick={handleItemClick}>Delete</Item>

            {/* Maybe add root-specific items differently later if needed */}
            {/* <Separator />
            <Item id="add-folder-root" onClick={handleItemClick}>Add Folder to Root</Item>
            <Item id="add-bookmark-root" onClick={handleItemClick}>Add Bookmark to Root</Item> */}
        </Menu>
    );
};

export default FolderContextMenu; 