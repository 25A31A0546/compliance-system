import * as SQLite from 'expo-sqlite';

// Initialize connection
const getDBConnection = async () => {
    return await SQLite.openDatabaseAsync('inspection_history.db');
};

// 1. Initialize Tables
export const initDatabase = async () => {
    try {
        const db = await getDBConnection();
        await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Migrate older DBs that lack the synced column (safe no-op if it exists)
        try {
            await db.execAsync('ALTER TABLE inspections ADD COLUMN synced INTEGER NOT NULL DEFAULT 0;');
        } catch (_) {
            // Column already exists — ignore
        }
        console.log('Database initialized successfully.');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

// 2. Insert Inspection Result
export const insertInspection = async (productName, status, details) => {
    try {
        const db = await getDBConnection();
        const detailsString = typeof details === 'object' ? JSON.stringify(details) : details;

        const result = await db.runAsync(
            'INSERT INTO inspections (product_name, status, details) VALUES (?, ?, ?);',
            [productName, status, detailsString]
        );
        return result.lastInsertRowId;
    } catch (error) {
        console.error('Failed to save inspection:', error);
        throw error;
    }
};

// 3. Query Past Audit Logs (all records, newest first)
export const getInspections = async () => {
    try {
        const db = await getDBConnection();
        const records = await db.getAllAsync('SELECT * FROM inspections ORDER BY created_at DESC;');
        return records;
    } catch (error) {
        console.error('Failed to fetch inspection logs:', error);
        return [];
    }
};

// 4. Query only records that have NOT yet been synced to the remote API
export const getUnsyncedInspections = async () => {
    try {
        const db = await getDBConnection();
        const records = await db.getAllAsync(
            'SELECT * FROM inspections WHERE synced = 0 ORDER BY created_at ASC;'
        );
        return records;
    } catch (error) {
        console.error('Failed to fetch unsynced inspection logs:', error);
        return [];
    }
};

// 5. Mark a specific inspection record as synced
export const markAsSynced = async (id) => {
    try {
        const db = await getDBConnection();
        await db.runAsync('UPDATE inspections SET synced = 1 WHERE id = ?;', [id]);
    } catch (error) {
        console.error(`Failed to mark inspection ${id} as synced:`, error);
    }
};