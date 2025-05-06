# Zenmark Web App Product Requirements Document (PRD)

## 1. Overview

### 1.1 Purpose
Zenmark is a web-based bookmark manager that enables users to import, organize, and export Chrome and Edge bookmark HTML files through a file-manager-like interface. It addresses native browser pain points—massive collections, poor UX, duplicates, and lack of search—by providing scalable storage with client-side persistence (IndexedDB), intuitive drag-and-drop, effective search, duplicate identification, and reliable export, capped at 10,000 bookmarks per upload/session.

### 1.2 Background
As of [Current Date - e.g., July 2024], the Zenmark web app ([https://github.com/4DVibes/zenmark-web](https://github.com/4DVibes/zenmark-web)) has completed its core MVP features and initial performance enhancements. It now supports:
- Uploading and parsing Chrome/Edge bookmark HTML files (up to 10,000 items). **Resolved issues with parsing nested folder structures.**
- Persistent storage using IndexedDB.
- A two-panel UI (Folder Tree on left, Contents on right) with virtualization (`react-window`) for scalability. **Layout updated with header, action bar, and panels.**
- Drag-and-drop reordering (basic implementation, needs refinement for inter-panel drops).
- Search functionality (filtering both folder tree and content panel). **Needs debugging.**
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
  - Implemented two-panel layout (`FolderTreePanel`, `BookmarkListPanel`). **Layout refined with dedicated header and action bar.** Core interaction (selecting folder displays contents) is now functional after parser fixes.
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
  - Added `SearchBar` component **(moved to right panel)**.
  - Implemented real-time filtering logic (`filterBookmarkTree`) updating both folder tree (dimming non-matches) and content panel.
  - Search is case-insensitive and includes a clear button.
- **Requirements Pending/Needs Refinement**: **Search filtering is currently broken and needs debugging.**
- **Success Criteria**: Functionality implemented. Performance with large datasets needs validation.

#### 3.1.4 Duplicate Identification
- **Description**: Identify and optionally remove duplicates (same URL).
- **Requirements Met**:
  - Added `findDuplicateUrls` in `treeUtils.ts`.
  - Highlighted duplicates in the content panel (`BookmarkListPanel` via `BookmarkItem`).
  - Added "Remove Duplicates" button with confirmation dialog (`App.tsx`). **Button moved to top action bar.**
- **Success Criteria**: Functionality implemented and verified.

#### 3.1.5 Bookmark Export
- **Description**: Export bookmark tree as Chrome/Edge-compatible HTML.
- **Requirements Met**:
  - Added `generateBookmarkHtml` in `bookmarkParser.ts`.
  - Triggered download in `App.tsx` using `Blob` and named `zenmark_bookmarks.html`. **Button moved to top action bar.**
- **Success Criteria**: Functionality implemented. Compatibility testing needed.

### 3.2 Non-Functional Requirements
- **Performance**: Parse/display target (<2s for 10k) needs validation. Drag-and-drop target (<100ms) needs validation and refinement. **Initial virtualization implemented.**
- **Compatibility**: Supports Chrome/Edge bookmark HTML format (basic validation done).
- **Persistence**: Bookmark data persists in IndexedDB across browser sessions (verified).
- **Accessibility**: Basic keyboard navigation **not yet implemented**.
- **Responsive**: Basic layout exists, **responsive breakpoints adjusted (`lg:`)**. Further testing needed.

## 4. Technical Requirements
- **Frontend**: React 18.2.0, TypeScript 5.2.2.
- **Build Tool**: Vite 5.2.0.
- **Styling**: Tailwind CSS 3.4.4.
- **Drag-and-Drop**: `@dnd-kit/core` 6.1.0.
- **Parsing**: `FileReader`, `DOMParser`.
- **Storage**: IndexedDB (`idb` library).
- **State**: React `useState`, `useCallback`, `useMemo`.
- **Virtualization**: `react-window` (^1.8.x), **`react-virtualized-auto-sizer`**. 
- **Dependencies**: Updated `package.json`.
- **Project Structure** (Updated conceptual structure):
  ```
  zenmark-web/
  ├── ... (public, config files)
  ├── src/
  │   ├── components/
  │   │   ├── FileUpload.tsx
  │   │   ├── SearchBar.tsx
  │   │   ├── FolderTreePanel.tsx
  │   │   ├── BookmarkListPanel.tsx
  │   │   ├── BookmarkItem.tsx
  │   │   ├── Modal.tsx
  │   │   ├── AddFolderModalContent.tsx
  │   │   └── AddBookmarkModalContent.tsx
  │   ├── utils/
  │   │   ├── bookmarkParser.ts
  │   │   ├── bookmarkStorage.ts
  │   │   ├── treeUtils.ts
  │   │   └── debounce.ts 
  │   ├── types/
  │   │   └── bookmark.ts (contains BookmarkNode, FlattenedBookmarkNode)
  │   ├── styles/
  │   │   └── ...
  │   ├── App.tsx
  │   └── main.tsx
  └── ... (package.json, etc.)
  ```

## 5. User Interface Requirements
- **Layout**: Updated to include a **dedicated header** (Logo/Title), a **top action bar** (Upload, Export, etc.), and **two main panels**. Left panel shows a virtualized folder tree. Right panel shows a virtualized list of the selected folder's contents (bookmarks only) with a **heading and search bar above the list**.
- **Components**:
  - **FileUpload**: (Unchanged, moved to action bar).
  - **SearchBar**: (Unchanged, moved to right panel header).
  - **FolderTreePanel**: Displays virtualized, hierarchical folder list with expand/collapse, selection highlighting. Dims non-matching folders during search. **Heading style updated. Row height increased.** **TODO: Add "All Bookmarks" root representation.** **TODO: Add "Add Folder" button in header.**
  - **BookmarkListPanel**: Displays virtualized list of bookmarks for the selected folder. Handles duplicate highlighting and right-click deletion. **TODO: Add "Add Bookmark" button in header.**
  - **BookmarkItem**: Reusable component for rendering individual bookmarks/folders. **Text left-aligned.**
  - **Modal Components**: Used for adding/editing.
- **Styling**: (Largely unchanged, adapted for new layout).
- **Responsive**: **Layout switches from vertical stack to horizontal (`lg:`)**. Top action bar reflows. Needs further review.

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

### Phase 2: Core Functionality & Polish (Current)

*   **DONE:** ~~DND Refinements:~~ Address limitations from Phase 1.
    *   ✅ Reordering folders within the left panel.
    *   ✅ Reordering bookmarks within the right panel.
    *   ✅ Moving bookmarks between panels (right list -> left folder).
    *   ✅ Moving folders between levels (including root).
*   **DONE:** ~~Bookmark Saving:~~ Persist bookmark data locally (e.g., IndexedDB).
*   **DONE:** ~~UI Polish: Modals~~ Replace `window.prompt` for Add/Edit with proper modals.
*   **DONE:** ~~UI Polish: Layout/Styling~~ Refactor main layout, adjust text alignment, increase folder row height.
*   **UI Polish:** Improve inline editing UI/UX.
*   **UI Polish (In Progress):** Responsiveness (ensure usability on smaller screens).
*   **NEW (TODO): Search Functionality:** Fix search filtering (currently broken).
*   **DONE:** ~~UI Polish: Implement "Add New" buttons in panel headers.~~
*   **NEW (TODO): UI Polish:** Add "All Bookmarks" root representation in folder tree.
*   **DEFERRED:** ~~Performance Validation:~~ Test with large bookmark files (e.g., 10k+ items).

### Phase 3: Advanced Features

*   **DONE:** ~~Search/Filtering:~~ Implement efficient search across titles, URLs, tags, notes.
*   Duplicate Detection/Resolution.
*   **NEW (TODO): Multi-select & Bulk Actions:** Implement multi-selection and a "Delete Selected" action.
*   More Robust Error Handling.

### Future Enhancements

*   **NEW:** Tags/Notes UI: Add/edit/view tags and notes associated with bookmarks.
*   **NEW:** Keyboard Navigation: Review/enhance for accessibility.
*   More sophisticated DND (e.g., dropping *between* folders vs *onto* folders in the left panel).
*   Settings Panel (e.g., configure storage, UI options).
*   Multi-select.
*   Integration with browser extensions/APIs (if feasible).
*   Cloud sync options.

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
- **Risk**: Virtualization library integration issues (`react-window`, `react-virtualized-auto-sizer`).
  - **Mitigation**: Addressed initial integration. Monitor for edge cases or performance issues.

## 9. Future Enhancements
- Cloud syncing with Firebase.
- Chrome/Edge extension.
- Page content search.
- AI-driven categorization.

## 10. Appendix
- **Tech Stack**: React, TypeScript, Vite, Tailwind CSS, `@dnd-kit/core`, IndexedDB, `idb`, `react-window`, `react-virtualized-auto-sizer`.
- **References**: User trends (massive collections, poor UX, scalability needs).
- **Stakeholders**: Developer (4DVibes), Chrome/Edge users.