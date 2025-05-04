# Zenmark Web App Product Requirements Document (PRD)

## 1. Overview

### 1.1 Purpose
Zenmark is a web-based bookmark manager that enables users to import, organize, and export Chrome and Edge bookmark HTML files through a file-manager-like interface. It addresses native browser pain points—massive collections, poor UX, duplicates, and lack of search—by providing scalable storage with client-side persistence (IndexedDB), intuitive drag-and-drop, effective search, duplicate identification, and reliable export, capped at 10,000 bookmarks per upload/session.

### 1.2 Background
As of [Current Date - e.g., July 2024], the Zenmark web app ([https://github.com/4DVibes/zenmark-web](https://github.com/4DVibes/zenmark-web)) has completed its core MVP features and initial performance enhancements. It now supports:
- Uploading and parsing Chrome/Edge bookmark HTML files (up to 10,000 items). **Resolved issues with parsing nested folder structures.**
- Persistent storage using IndexedDB.
- A two-panel UI (Folder Tree on left, Contents on right) with virtualization (`react-window`) for scalability.
- Drag-and-drop reordering (basic implementation, needs refinement for inter-panel drops).
- Search functionality (filtering both folder tree and content panel).
- Duplicate detection (based on URL) and removal.
- Exporting bookmarks back to Chrome/Edge compatible HTML format.

This PRD outlines the completed MVP and ongoing development phases.

### 1.3 Goals
- **Primary Goal**: Deliver an intuitive web app for managing up to 10,000 Chrome/Edge bookmarks with persistent storage.
- **Secondary Goals**:
  - Support scalable organization with folders, tags, and notes.
  - Enable drag-and-drop and simple actions (e.g., right-click delete).
  - Provide fast search and duplicate identification.
  - Ensure reliable import/export compatible with Chrome/Edge.

## 2. Target Audience
- **Primary Users**: Chrome and Edge users with large bookmark collections (e.g., researchers, students).
- **User Needs**:
  - Manage up to 10,000 bookmarks efficiently with persistence across sessions.
  - Organize intuitively with minimal effort.
  - Find bookmarks quickly via search.
  - Reduce clutter from duplicates.

## 3. Functional Requirements

### 3.1 Core MVP Features (Completed)
#### 3.1.1 Scalable Storage and Organization with Persistence
- **Description**: Handle up to 10,000 bookmarks with flexible organization and client-side persistence.
- **Requirements Met**:
  - Supported `tags` and `notes` in `BookmarkNode` (though UI for editing not yet implemented).
  - Capped uploads at 10,000 bookmarks in `bookmarkParser.ts`. **Successfully debugged parser for complex nested structures.**
  - Used IndexedDB (`idb` library) to persist `BookmarkNode` tree across sessions (`bookmarkStorage.ts`).
  - Implemented basic performance optimization via virtualization (`react-window`) in rendering.
- **Success Criteria**: Functionality implemented. Performance target (<2s load/display for 10k) needs validation. Data persistence verified. **Parser logic validated.**

#### 3.1.2 Intuitive UX with Drag-and-Drop
- **Description**: Clean, interactive UI with drag-and-drop and simple actions.
- **Requirements Met**:
  - Implemented two-panel layout (`FolderTreePanel`, `BookmarkListPanel`). **Core interaction (selecting folder displays contents) is now functional after parser fixes.**
  - Basic drag-and-drop for reordering within panels using `@dnd-kit/core`.
  - **Implemented context menus (`react-contexify`) for right-click actions: Add Folder, Add Bookmark, Rename, Delete.**
  - Expand/collapse implemented for folder tree panel.
  - Used Tailwind CSS for styling.
- **Requirements Pending/Needs Refinement**:
  - Drag-and-drop between panels (item to folder, folder reordering).
  - Keyboard navigation.
- **Success Criteria**: Core UI implemented. Drag-and-drop interaction needs refinement.

#### 3.1.3 Effective Search
- **Description**: Fast search by title, URL, and notes.
- **Requirements Met**:
  - Added `SearchBar` component.
  - Implemented real-time filtering logic (`filterBookmarkTree`) updating both folder tree (dimming non-matches) and content panel.
  - Search is case-insensitive and includes a clear button.
- **Success Criteria**: Functionality implemented. Performance with large datasets needs validation.

#### 3.1.4 Duplicate Identification
- **Description**: Identify and optionally remove duplicates (same URL).
- **Requirements Met**:
  - Added `findDuplicateUrls` in `treeUtils.ts`.
  - Highlighted duplicates in the content panel (`BookmarkListPanel` via `BookmarkItem`).
  - Added "Remove Duplicates" button with confirmation dialog (`App.tsx`).
- **Success Criteria**: Functionality implemented and verified.

#### 3.1.5 Bookmark Export
- **Description**: Export bookmark tree as Chrome/Edge-compatible HTML.
- **Requirements Met**:
  - Added `generateBookmarkHtml` in `bookmarkParser.ts`.
  - Triggered download in `App.tsx` using `Blob` and named `zenmark_bookmarks.html`.
- **Success Criteria**: Functionality implemented. Compatibility testing needed.

### 3.2 Non-Functional Requirements
- **Performance**: Parse/display target (<2s for 10k) needs validation. Drag-and-drop target (<100ms) needs validation and refinement. **Initial virtualization implemented.**
- **Compatibility**: Supports Chrome/Edge bookmark HTML format (basic validation done).
- **Persistence**: Bookmark data persists in IndexedDB across browser sessions (verified).
- **Accessibility**: Basic keyboard navigation **not yet implemented**.
- **Responsive**: Basic layout exists, further testing needed for tablet responsiveness.

## 4. Technical Requirements
- **Frontend**: React 18.2.0, TypeScript 5.2.2.
- **Build Tool**: Vite 5.2.0.
- **Styling**: Tailwind CSS 3.4.4.
- **Drag-and-Drop**: `@dnd-kit/core` 6.1.0.
- **Parsing**: `FileReader`, `DOMParser`.
- **Storage**: IndexedDB (`idb` library).
- **State**: React `useState`, `useCallback`, `useMemo`.
- **Virtualization**: `react-window` (^1.8.x).
- **Dependencies**: Updated `package.json`.
- **Project Structure** (Updated conceptual structure):
  ```
  zenmark-web/
  ├── ... (public, config files)
  ├── src/
  │   ├── components/
  │   │   ├── FileUpload.tsx
  │   │   ├── SearchBar.tsx
  │   │   ├── FolderTreePanel.tsx  // New
  │   │   ├── BookmarkListPanel.tsx // New
  │   │   └── BookmarkItem.tsx      // Reused item renderer
  │   ├── utils/
  │   │   ├── bookmarkParser.ts
  │   │   ├── bookmarkStorage.ts
  │   │   └── treeUtils.ts
  │   ├── types/
  │   │   └── bookmark.ts (contains BookmarkNode, FlattenedBookmarkNode)
  │   ├── styles/
  │   │   └── ...
  │   ├── App.tsx
  │   └── main.tsx
  └── ... (package.json, etc.)
  ```

## 5. User Interface Requirements
- **Layout**: Updated to a **two-panel layout**. Left panel shows a virtualized folder tree. Right panel shows a virtualized list of the selected folder's contents (bookmarks only). Top bar contains header, file upload, search, and action buttons (Export, Remove Duplicates).
- **Components**:
  - **FileUpload**: (Unchanged).
  - **SearchBar**: (Unchanged).
  - **FolderTreePanel**: Displays virtualized, hierarchical folder list with expand/collapse, selection highlighting. Dims non-matching folders during search.
  - **BookmarkListPanel**: Displays virtualized list of bookmarks for the selected folder. Handles duplicate highlighting and right-click deletion.
  - **BookmarkItem**: Reusable component for rendering individual bookmarks/folders (used by BookmarkListPanel, potentially adaptable for FolderTreePanel row if needed).
- **Styling**: (Largely unchanged, adapted for two panels).
- **Responsive**: Needs review for two-panel layout on smaller screens.

## 6. Development Phases
### Phase 1: MVP Core (Completed)
- **Tasks Completed**:
  - Update `BookmarkNode` with `tags` and `notes`.
  - Add IndexedDB persistence.
  - Cap uploads at 10,000 bookmarks.
  - Implement core tree interactions (expand/collapse, right-click delete).
  - Add Search bar and filtering logic.
  - Implement duplicate identification and removal.
  - Add bookmark export.
- **Deliverables**: Interactive bookmark manager with persistent storage, search, duplicate handling, and export. Initial two-panel UI implemented.

### Phase 2: Enhancements (In Progress)
- **Tasks**:
  - **Performance Optimizations**:
    - [Partially Addressed] Optimize rendering for large datasets using virtualization (`react-window`).
    - [Completed] Implement debouncing for IndexedDB saves on frequent updates (e.g., DND).
    - [Completed] Implement debouncing for search input filtering.
    - [Deferred to Testing] Validate performance against 10k bookmark target.
  - **Drag-and-Drop Refinement**:
    - [Completed] Implement reliable DND *within* the right panel (reordering items).
    - [Completed] Implement DND *between* panels (dragging items/folders from right panel onto folders in left panel).
    - [Completed - Basic] Implement DND *within* the left panel (reordering folders among siblings).
  - **Add Bookmark Saving**:
    - [Pending] Add UI (e.g., a form or button) to manually add a new bookmark (URL and title).
    - [Pending] Implement logic to add the new bookmark to the tree structure and persist it.
  - **UI Polish**:
    - **[Pending] Replace `window.prompt` with modal dialogs for Add/Edit actions.**
    - [Pending] Add UI for viewing/editing tags and notes.
    - [Pending] Improve responsive layout for tablet/smaller screens.
    - [Pending] Implement basic keyboard navigation for accessibility.
- **Deliverables**: Polished, performant app with refined DND and bookmark adding capabilities.

### Phase 3: Advanced Features (Future)
- **Tasks**:
  - **Refine Folder DND**: Enhance drag-and-drop within the folder tree (left panel) to visually distinguish and handle dropping *onto* a folder (reparenting) versus dropping *between* folders (reordering siblings).
  - Add cloud syncing (backend).
  - Implement dead link detection (API).
  - Integrate archiving (e.g., Internet Archive).
  - Add password-protected folders.
- **Deliverables**: Fully featured app.

## 7. Success Metrics
- **Engagement**: 80% of users manage bookmarks in <5 minutes.
- **Performance**: 10,000 bookmarks in <2 seconds.
- **Persistence**: Data retained across sessions.
- **Usability**: 90% UX satisfaction.

## 8. Risks and Mitigations
- **Risk**: IndexedDB performance with 10,000 bookmarks.
  - **Mitigation**: Virtualization implemented. **Debouncing saves implemented.** Test with large datasets.
- **Risk**: Drag-and-drop complexity (especially with virtualization and two panels).
  - **Mitigation**: Incremental implementation planned. Test thoroughly. Refer to `@dnd-kit` documentation for virtualization strategies if needed.
- **Risk**: Browser compatibility issues (HTML format, IndexedDB).
  - **Mitigation**: Test with Chrome and Edge bookmark HTML files. Test IndexedDB in target browsers.
- **Risk**: Virtualization library integration issues (`react-window`).
  - **Mitigation**: Addressed initial integration. Monitor for edge cases or performance issues.

## 9. Future Enhancements
- Cloud syncing with Firebase.
- Chrome/Edge extension.
- Page content search.
- AI-driven categorization.

## 10. Appendix
- **Tech Stack**: React, TypeScript, Vite, Tailwind CSS, `@dnd-kit/core`, IndexedDB, **`react-window`**.
- **References**: User trends (massive collections, poor UX, scalability needs).
- **Stakeholders**: Developer (4DVibes), Chrome/Edge users.