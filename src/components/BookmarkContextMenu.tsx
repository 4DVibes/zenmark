import React from 'react';
import { Menu, Item } from 'react-contexify';
import { BOOKMARK_MENU_ID } from '../App'; // Import the ID

// Interface for the props passed *from* the trigger (BookmarkItem)
interface TriggerProps {
    nodeId: string;
    parentId?: string | null;
    onEdit: () => void; // Changed from onEditNode
    onDelete: () => void; // Changed from onDeleteNode
    onAddBookmark?: (parentId: string | null) => void; // Optional add handler
}

const BookmarkContextMenu: React.FC = () => {
    // Type the props received by handleItemClick correctly
    const handleItemClick = ({ id, props }: { id?: string, props?: TriggerProps }) => {
        console.log(`[BookmarkContextMenu] handleItemClick: id=${id}, propsNodeId=${props?.nodeId}`);
        if (!props) return;

        switch (id) {
            case 'edit':
                if (props.onEdit) {
                    props.onEdit(); // Call the passed function
                } else {
                    console.error('onEdit handler missing in context menu props');
                }
                break;
            case 'delete':
                if (props.onDelete) {
                    props.onDelete(); // Call the passed function
                } else {
                    console.error('onDelete handler missing in context menu props');
                }
                break;
            // Add case for future actions if needed, e.g.:
            // case 'add_bookmark_here':
            //     if (props.onAddBookmark && props.parentId !== undefined) {
            //         props.onAddBookmark(props.parentId);
            //     } else {
            //         console.error('onAddBookmark handler or parentId missing');
            //     }
            //     break;
            default:
                console.warn(`Unknown context menu item clicked: ${id}`);
        }
    };

    return (
        <Menu id={BOOKMARK_MENU_ID}>
            <Item id="edit" onClick={handleItemClick}>Edit</Item>
            {/* Add other relevant items later */}
            <Item id="delete" onClick={handleItemClick}>Delete</Item>
        </Menu>
    );
};

export default BookmarkContextMenu; 