# Zenmark Web App Product Requirements Document (PRD)

## 1. Overview

### 1.1 Purpose
Zenmark is a web-based bookmark manager that enables users to import, organize, and export Chrome and Edge bookmark HTML files through a file-manager-like interface. It addresses native browser pain points—massive collections, poor UX, duplicates, and lack of search—by providing scalable storage with client-side persistence (IndexedDB), intuitive drag-and-drop, effective search, duplicate identification, and reliable export, capped at 10,000 bookmarks per upload/session.

### 1.2 Background
As of May 1, 2025, the Zenmark web app ([https://github.com/4DVibes/zenmark-web](https://github.com/4DVibes/zenmark-web)) supports:
- Uploading and parsing Chrome/Edge bookmark HTML files into a nested list.
- Displaying bookmarks with Tailwind CSS styling.
- A placeholder export button.

The app’s limited functionality (in-memory storage, no persistence, basic UX) makes it insufficient. This PRD, informed by user research on bookmark hoarding, poor native UX, and scalability needs, defines an MVP with IndexedDB persistence and a 10,000-bookmark cap to enhance usability.

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

### 3.1 Core MVP Features
#### 3.1.1 Scalable Storage and Organization with Persistence
- **Description**: Handle up to 10,000 bookmarks with flexible organization and client-side persistence.
- **Requirements**:
  - Support folders (existing), tags, and notes in `BookmarkNode`.
  - Cap uploads at 10,000 bookmarks with user-friendly error in `bookmarkParser.ts`.
  - Use IndexedDB to persist `BookmarkNode` tree across sessions.
  - Optimize parsing (`bookmarkParser.ts`) and rendering (`BookmarkTree`) for performance.
- **Success Criteria**: Parse/display 10,000 bookmarks in <2 seconds; data persists after refresh; users can add tags/notes.

#### 3.1.2 Intuitive UX with Drag-and-Drop
- **Description**: Clean, interactive UI with drag-and-drop and simple actions.
- **Requirements**:
  - Implement `BookmarkTree` with expand/collapse, drag-and-drop (`@dnd-kit/core`), and right-click deletion.
  - Use Tailwind CSS for visual tree view (indented nodes, hover effects).
  - Support keyboard navigation (arrow keys to toggle folders).
- **Success Criteria**: Users can drag/reorder bookmarks, delete via right-click, and toggle folders.

#### 3.1.3 Effective Search
- **Description**: Fast search by title, URL, and notes.
- **Requirements**:
  - Add `SearchBar` for real-time filtering of `BookmarkNode` tree.
  - Search case-insensitively with Tailwind CSS styling (clear button, focus states).
- **Success Criteria**: Query filters bookmarks instantly.

#### 3.1.4 Duplicate Identification
- **Description**: Identify and optionally remove duplicates (same URL).
- **Requirements**:
  - Add `findDuplicates` in `bookmarkParser.ts` to detect matching URLs.
  - Highlight duplicates in `BookmarkTree` (e.g., red badge).
  - Optional “Remove Duplicates” button with confirmation dialog.
- **Success Criteria**: Duplicates are highlighted; removal updates tree correctly.

#### 3.1.5 Bookmark Export
- **Description**: Export bookmark tree as Chrome/Edge-compatible HTML.
- **Requirements**:
  - Add `generateBookmarkHtml` in `bookmarkParser.ts` for HTML output.
  - Trigger download in `App.tsx` (`Blob`, `zenmark_bookmarks.html`).
- **Success Criteria**: Exported file is importable by Chrome/Edge without errors.

### 3.2 Non-Functional Requirements
- **Performance**: Parse/display 10,000 bookmarks in <2 seconds; drag-and-drop responds in <100ms.
- **Compatibility**: Supports Chrome/Edge bookmark HTML format (May 2025).
- **Persistence**: Bookmark data persists in IndexedDB across browser sessions.
- **Accessibility**: Basic WCAG 2.1 compliance (keyboard navigation).
- **Responsive**: Desktop (min 1024px), tablet (min 768px).

## 4. Technical Requirements
- **Frontend**: React 18.2.0, TypeScript 5.2.2.
- **Build Tool**: Vite 5.2.0.
- **Styling**: Tailwind CSS 3.4.4.
- **Drag-and-Drop**: `@dnd-kit/core` 6.1.0.
- **Parsing**: `FileReader`, `DOMParser`.
- **Storage**: IndexedDB for client-side persistence.
- **State**: React `useState` for in-memory session data.
- **Dependencies**: Current `package.json`.
- **Project Structure**:
  ```
  zenmark-web/
  ├── public/
  │   └── favicon.ico
  ├── src/
  │   ├── components/
  │   │   ├── FileUpload.tsx
  │   │   ├── BookmarkTree.tsx
  │   │   └── SearchBar.tsx
  │   ├── utils/
  │   │   ├── bookmarkParser.ts
  │   │   └── bookmarkStorage.ts
  │   ├── types/
  │   │   └── bookmark.ts
  │   ├── styles/
  │   │   └── tailwind.css
  │   ├── App.tsx
  │   └── main.tsx
  ├── index.html
  ├── package.json
  ├── tsconfig.json
  ├── tsconfig.app.json
  ├── tsconfig.node.json
  ├── vite.config.ts
  ├── tailwind.config.js
  └── postcss.config.js
  ```

## 5. User Interface Requirements
- **Layout**: Centered card with “Zenmark” header, `SearchBar`, `BookmarkTree`, export button.
- **Components**:
  - **FileUpload**: Styled input for HTML upload (existing).
  - **BookmarkTree**: Tree with drag-and-drop, expand/collapse, right-click deletion.
  - **SearchBar**: Input with real-time filtering, clear button.
- **Styling**: Tailwind CSS (gray background, white card, green buttons).
- **Responsive**: Stack vertically on tablet; adjust tree indentation.

## 6. Development Phases
### Phase 1: MVP Core (2-3 Weeks)
- **Tasks**:
  - Update `BookmarkNode` with `tags` and `notes`.
  - Add IndexedDB in `bookmarkStorage.ts` for persistence.
  - Cap uploads at 10,000 bookmarks in `bookmarkParser.ts`.
  - Implement `BookmarkTree` (drag-and-drop, expand/collapse, right-click).
  - Add `SearchBar` for title/URL/notes search.
  - Implement duplicate identification, optional removal.
  - Add `generateBookmarkHtml` and export download.
- **Deliverables**: Interactive bookmark manager with persistent storage.

### Phase 2: Enhancements (2-3 Weeks)
- **Tasks**:
  - Optimize for edge cases (e.g., 10,000 bookmarks with deep nesting).
  - Add bookmark saving (URL input form).
- **Deliverables**: Polished, scalable app.

### Phase 3: Advanced Features (4+ Weeks)
- **Tasks**:
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
  - **Mitigation**: Optimize storage with efficient serialization, test with large datasets.
- **Risk**: Drag-and-drop complexity.
  - **Mitigation**: Use `@dnd-kit/core` examples, test incrementally.
- **Risk**: Browser compatibility issues.
  - **Mitigation**: Test with Chrome and Edge bookmark HTML files.

## 9. Future Enhancements
- Cloud syncing with Firebase.
- Chrome/Edge extension.
- Page content search.
- AI-driven categorization.

## 10. Appendix
- **Tech Stack**: React, TypeScript, Vite, Tailwind CSS, `@dnd-kit/core`, IndexedDB.
- **References**: User trends (massive collections, poor UX, scalability needs).
- **Stakeholders**: Developer (4DVibes), Chrome/Edge users.