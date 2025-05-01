export interface BookmarkNode {
    id: string;
    title: string;
    url?: string;
    tags?: string[]; // Optional tags for organization
    notes?: string; // Optional notes for bookmarks
    children?: BookmarkNode[];
}