import React from 'react';
import { Menu, Item, Separator, Submenu, useContextMenu } from 'react-contexify';
import { FOLDER_MENU_ID } from '../App'; // Import the ID

interface FolderContextMenuProps {
    triggerEvent: Event | null; // The event that triggered the menu
    nodeId: string | null; // The ID of the folder right-clicked (null for root/background)
    onAddFolder: (parentId: string | null) => void;
    onAddBookmark: (parentId: string | null) => void;
    onEditNode: (nodeId: string) => void;
    onDeleteNode: (nodeId: string) => void;
}

const FolderContextMenu: React.FC = () => {
    // We access props passed to show() via the Item's onClick
    const handleItemClick = ({ id, props }: { id?: string, props?: FolderContextMenuProps }) => {
        console.log(`[FolderContextMenu] handleItemClick: id=${id}, propsNodeId=${props?.nodeId}`);
        if (!props || !props.nodeId) {
            // Handle clicks on root/background actions
            switch (id) {
                case 'add-folder-root':
                    props?.onAddFolder(null); // Add folder to root
                    break;
                case 'add-bookmark-root':
                    props?.onAddBookmark(null); // Add bookmark to root
                    break;
            }
            return;
        }

        // Handle clicks on specific folder items
        switch (id) {
            case 'add-folder':
                props.onAddFolder(props.nodeId);
                break;
            case 'add-bookmark':
                props.onAddBookmark(props.nodeId);
                break;
            case 'edit':
                props.onEditNode(props.nodeId);
                break;
            case 'delete':
                props.onDeleteNode(props.nodeId);
                break;
            default:
                console.warn(`Unknown context menu item clicked: ${id}`);
        }
    };

    return (
        <Menu id={FOLDER_MENU_ID}>
            {/* Items shown when right-clicking a specific folder */}
            <Item id="add-folder" onClick={handleItemClick}>Add New Folder Inside</Item>
            <Item id="add-bookmark" onClick={handleItemClick}>Add New Bookmark Inside</Item>
            <Separator />
            <Item id="edit" onClick={handleItemClick}>Rename Folder</Item>
            <Item id="delete" onClick={handleItemClick}>Delete Folder</Item>
            <Separator />
            {/* Items shown when right-clicking the root/background */}
            <Item id="add-folder-root" onClick={handleItemClick}>Add Folder to Root</Item>
            <Item id="add-bookmark-root" onClick={handleItemClick}>Add Bookmark to Root</Item>
        </Menu>
    );
};

export default FolderContextMenu; 