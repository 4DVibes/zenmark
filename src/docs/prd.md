# Zenmark Web App Product Requirements Document (PRD)

## 1. Overview

### 1.1 Purpose
Zenmark is a web-based bookmark manager that enables users to import, organize, and export Chrome and Edge bookmark HTML files through a file-manager-like interface. It addresses native browser pain points—massive collections, poor UX, duplicates, and lack of search—by providing scalable storage with client-side persistence (IndexedDB), intuitive drag-and-drop, effective search, duplicate identification, and reliable export, capped at 10,000 bookmarks per upload/session.

### 1.2 Background
As of [Current Date], the Zenmark web app has completed Phase 2 of development, building upon the core MVP features with significant UI/UX improvements and performance optimizations. The app now supports:

**Phase 1 (MVP) Features:**
- Uploading and parsing Chrome/Edge bookmark HTML files (up to 10,000 items)
- Persistent storage using IndexedDB
- Two-panel UI with virtualization for scalability
- Basic drag-and-drop reordering
- Search functionality (filtering both folder tree and content panel)
- Duplicate detection and removal
- Exporting bookmarks to Chrome/Edge compatible HTML format

**Phase 2 Enhancements:**
- **UI/UX Improvements:**
  - Added Zenmark branding with slogan and improved logo section
  - Enhanced responsive design with better breakpoints
  - Improved search bar with clearer placeholder text
  - Better visual hierarchy in folder tree and bookmark list
  - Consistent left alignment for better readability
- **Search Enhancements:**
  - Global search across all folders implemented
  - Improved search performance with optimized filtering
  - Better visual feedback for matching folders
  - Clearer search results presentation
- **Performance Optimizations:**
  - Implemented caching for search results
  - Optimized bookmark tree filtering
  - Reduced unnecessary re-renders
  - Added detailed logging for debugging
- **Bug Fixes:**
  - Fixed folder tree and bookmark list interactions
  - Resolved search filtering issues
  - Improved drag-and-drop behavior
  - Enhanced error handling and user feedback

### 1.3 Goals
- **Primary Goal**: Deliver an intuitive web app for managing up to 10,000 Chrome/Edge bookmarks with persistent storage.
- **Secondary Goals**:
  - Support scalable organization with folders and efficient search
  - Enable intuitive drag-and-drop and context menu actions
  - Provide fast, global search and duplicate identification
  - Ensure reliable import/export compatible with Chrome/Edge
  - Maintain a clean, zen-like user experience

## 2. Target Audience
- **Primary Users**: Chrome and Edge users with large bookmark collections (e.g., researchers, students).
- **User Needs**:
  - Manage up to 10,000 bookmarks efficiently with persistence across sessions.
  - Organize intuitively with minimal effort.
  - Find bookmarks quickly via search.
  - Reduce clutter from duplicates.

## 3. Functional Requirements

### 3.1 Core Features

#### 3.1.1 Bookmark Import
- **Description**: Import Chrome/Edge bookmark HTML files.
- **Requirements Met**:
  - Added `FileUpload` component with drag-and-drop support
  - Implemented `parseBookmarkFile` for HTML parsing
  - Added progress feedback and error handling
  - Limited to 10,000 bookmarks per import
- **Success Criteria**: Functionality implemented and verified.

#### 3.1.2 Organization & Navigation
- **Description**: Two-panel interface with folder tree and content view.
- **Requirements Met**:
  - Implemented `FolderTreePanel` and `BookmarkListPanel`
  - Added virtualization for performance
  - Implemented drag-and-drop reordering
  - Added context menus for actions
  - Enhanced folder tree with better visual hierarchy
- **Success Criteria**: Core UI implemented and refined in Phase 2.

#### 3.1.3 Effective Search
- **Description**: Fast, global search across all bookmarks.
- **Requirements Met**:
  - Implemented global search functionality
  - Added optimized filtering with caching
  - Enhanced visual feedback for matches
  - Improved search performance
  - Added clear search button
- **Success Criteria**: Functionality implemented and optimized in Phase 2.

#### 3.1.4 Duplicate Identification
- **Description**: Identify and remove duplicate bookmarks.
- **Requirements Met**:
  - Added duplicate detection
  - Visual highlighting of duplicates
  - Bulk removal functionality
  - Improved duplicate management UI
- **Success Criteria**: Functionality implemented and enhanced.

#### 3.1.5 Bookmark Export
- **Description**: Export to Chrome/Edge compatible HTML.
- **Requirements Met**:
  - Implemented HTML generation
  - Added export button to action bar
  - Improved export feedback
- **Success Criteria**: Functionality implemented and verified.

### 3.2 Non-Functional Requirements
- **Performance**: 
  - Search response < 100ms for 10k bookmarks
  - Smooth scrolling with virtualization
  - Efficient caching for repeated searches
  - Optimized tree operations
- **Compatibility**: 
  - Supports Chrome/Edge bookmark formats
  - Responsive design for various screen sizes
  - Consistent behavior across modern browsers
- **Persistence**: 
  - Reliable IndexedDB storage
  - Automatic save on changes
  - Error recovery mechanisms
- **Accessibility**: 
  - Keyboard navigation support
  - Clear visual hierarchy
  - Proper ARIA labels
  - High contrast text
- **Responsive**: 
  - Mobile-first design
  - Adaptive layouts
  - Touch-friendly interactions
  - Consistent experience across devices

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
- **Layout**:
  - Clean, minimalist design
  - Clear visual hierarchy
  - Consistent spacing and alignment
  - Responsive breakpoints
- **Components**:
  - Modern, accessible form elements
  - Intuitive drag handles
  - Clear action buttons
  - Informative tooltips
- **Feedback**:
  - Loading states
  - Error messages
  - Success confirmations
  - Progress indicators
- **Branding**:
  - Zenmark logo and slogan
  - Consistent color scheme
  - Professional typography
  - Subtle animations

## 6. Future Enhancements (Phase 3)
- Tag-based organization
- Advanced search filters
- Bookmark notes and descriptions
- Custom folder icons
- Import/Export to other formats
- Cloud sync capabilities
- Browser extension integration
- Collaborative features
- **UI/UX Overhaul**: Evaluate and integrate `shadcn/ui` for a more modern design aesthetic and robust component library, potentially rebuilding parts of the application for improved maintainability and user experience.

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

## 10. Appendix
- **Tech Stack**: React, TypeScript, Vite, Tailwind CSS, `@dnd-kit/core`, IndexedDB, `idb`, `react-window`, `react-virtualized-auto-sizer`.
- **References**: User trends (massive collections, poor UX, scalability needs).
- **Stakeholders**: Developer (4DVibes), Chrome/Edge users.