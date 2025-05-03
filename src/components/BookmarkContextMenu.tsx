import React from 'react';
import { Menu, Item } from 'react-contexify';
import { BOOKMARK_MENU_ID } from '../App'; // Import the ID

interface BookmarkContextMenuProps {
    triggerEvent: Event | null; // The event that triggered the menu
    nodeId: string; // The ID of the bookmark right-clicked
    onEditNode: (nodeId: string) => void;
    onDeleteNode: (nodeId: string) => void;
}

const BookmarkContextMenu: React.FC = () => {
    // Access props passed to show() via the Item's onClick
    const handleItemClick = ({ id, props }: { id?: string, props?: BookmarkContextMenuProps }) => {
        console.log(`[BookmarkContextMenu] handleItemClick: id=${id}, propsNodeId=${props?.nodeId}`);
        if (!props) return;

        switch (id) {
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
        <Menu id={BOOKMARK_MENU_ID}>
            <Item id="edit" onClick={handleItemClick}>Edit Bookmark</Item>
            <Item id="delete" onClick={handleItemClick}>Delete Bookmark</Item>
        </Menu>
    );
};

export default BookmarkContextMenu; 