import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { BookmarkNode } from '../types/bookmark';

const DB_NAME = 'ZenmarkDB';
const DB_VERSION = 1;
const STORE_NAME = 'bookmarks';
const BOOKMARKS_KEY = 'userBookmarks'; // Key to store the entire bookmark array

// Define the database schema using the DBSchema interface
interface ZenmarkDBSchema extends DBSchema {
    [STORE_NAME]: {
        key: string; // The key path for the object store
        value: BookmarkNode[]; // The type of object stored
    };
}

// Singleton promise to ensure DB is opened only once
let dbPromise: Promise<IDBPDatabase<ZenmarkDBSchema>> | null = null;

/**
 * Gets the IndexedDB database instance, opening it if necessary.
 * @returns {Promise<IDBPDatabase<ZenmarkDBSchema>>} A promise that resolves with the database instance.
 */
const getDB = (): Promise<IDBPDatabase<ZenmarkDBSchema>> => {
    if (!dbPromise) {
        dbPromise = openDB<ZenmarkDBSchema>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                console.log('Upgrading IndexedDB...');
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME); // Create store without keyPath, keys provided explicitly
                    console.log(`Object store '${STORE_NAME}' created.`);
                }
            },
        });
        dbPromise.then(() => console.log('IndexedDB initialized successfully.'))
            .catch(error => console.error('Failed to initialize IndexedDB:', error));
    }
    return dbPromise;
};

/**
 * Initializes the IndexedDB database connection.
 * This function is implicitly called by other functions when they first access the DB.
 * You can call it explicitly on app startup if needed.
 * @returns {Promise<IDBPDatabase<ZenmarkDBSchema>>} A promise that resolves with the database instance.
 */
export const initDB = async (): Promise<IDBPDatabase<ZenmarkDBSchema>> => {
    // Just ensures the DB connection is established by calling getDB
    return getDB();
};

/**
 * Saves the entire bookmark tree to IndexedDB.
 * Overwrites any existing data associated with the BOOKMARKS_KEY.
 * @param {BookmarkNode[]} bookmarks - The array of root bookmark nodes.
 * @returns {Promise<void>} A promise that resolves when saving is complete.
 */
export const saveBookmarks = async (bookmarks: BookmarkNode[]): Promise<void> => {
    try {
        const db = await getDB();
        await db.put(STORE_NAME, bookmarks, BOOKMARKS_KEY); // Store the array with the fixed key
        console.log('Bookmarks saved successfully to IndexedDB.');
    } catch (error) {
        console.error('Failed to save bookmarks:', error);
        throw new Error('Could not save bookmarks to IndexedDB.'); // Re-throw or handle as needed
    }
};

/**
 * Loads the bookmark tree from IndexedDB.
 * @returns {Promise<BookmarkNode[]>} A promise that resolves with the loaded bookmarks, or an empty array if none are found.
 */
export const loadBookmarks = async (): Promise<BookmarkNode[]> => {
    try {
        const db = await getDB();
        const bookmarks = await db.get(STORE_NAME, BOOKMARKS_KEY);
        if (bookmarks) {
            console.log('Bookmarks loaded successfully from IndexedDB.');
            return bookmarks;
        } else {
            console.log('No bookmarks found in IndexedDB.');
            return []; // Return empty array if no data found for the key
        }
    } catch (error) {
        console.error('Failed to load bookmarks:', error);
        // Depending on requirements, you might want to return empty array or re-throw
        return []; // Return empty array on error to avoid breaking the app
    }
}; 