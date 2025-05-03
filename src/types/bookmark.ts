export interface BookmarkNode {
    id: string;
    title: string;
    url?: string;
    tags?: string[]; // Optional tags for organization
    notes?: string; // Optional notes for bookmarks
    children?: BookmarkNode[];
    addDate?: number; // Optional timestamp (seconds since epoch)
    lastModified?: number; // Optional timestamp (seconds since epoch)
    parentId?: string | null; // Optional: ID of the parent folder (null for root nodes)
}

// Add FlattenedBookmarkNode interface here
export interface FlattenedBookmarkNode {
    id: string;
    node: BookmarkNode; // The original node data
    depth: number;      // Indentation level
    isExpanded?: boolean; // Applicable only to folders
}