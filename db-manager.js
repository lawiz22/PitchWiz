/**
 * Database Manager for PitchWiz
 * Handles IndexedDB operations for recordings and session data
 */

class DBManager {
    constructor() {
        this.dbName = 'PitchWizDB';
        this.version = 3; // Incremented for category index
        this.db = null;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Recordings store: audio + pitch data
                let recordingsStore;
                if (!db.objectStoreNames.contains('recordings')) {
                    recordingsStore = db.createObjectStore('recordings', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    recordingsStore.createIndex('date', 'date', { unique: false });
                    recordingsStore.createIndex('mode', 'mode', { unique: false });
                    recordingsStore.createIndex('singer', 'singer', { unique: false });
                    recordingsStore.createIndex('category', 'category', { unique: false });
                } else {
                    recordingsStore = event.target.transaction.objectStore('recordings');
                    if (!recordingsStore.indexNames.contains('singer')) {
                        recordingsStore.createIndex('singer', 'singer', { unique: false });
                    }
                    if (!recordingsStore.indexNames.contains('category')) {
                        recordingsStore.createIndex('category', 'category', { unique: false });
                    }
                }

                // Sessions store: metrics and analytics
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionsStore = db.createObjectStore('sessions', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    sessionsStore.createIndex('date', 'date', { unique: false });
                }

                // Settings store: user preferences
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Save a recording
     */
    async saveRecording(recordingData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');

            const recording = {
                date: recordingData.date || new Date().toISOString(),
                duration: recordingData.duration,
                mode: recordingData.mode,
                name: recordingData.name,
                singer: recordingData.singer,
                category: recordingData.category || 'freestyle', // Default to freestyle
                metrics: recordingData.metrics, // Critical: Include metrics!
                audioBlob: recordingData.audioBlob,
                pitchData: recordingData.pitchData,
                metadata: recordingData.metadata || {}
            };

            const request = store.add(recording);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all recordings
     */
    async getAllRecordings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a specific recording by ID
     */
    async getRecording(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a recording
     */
    async deleteRecording(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('Database cleared');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update recording metadata (name and singer)
     */
    async updateRecordingMetadata(id, name, singer) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const recording = getRequest.result;
                if (!recording) {
                    reject(new Error('Recording not found'));
                    return;
                }

                recording.name = name;
                if (singer) recording.singer = singer;

                // Ensure metadata object exists and update it too for consistency
                if (!recording.metadata) recording.metadata = {};
                recording.metadata.lastModified = new Date().toISOString();

                const updateRequest = store.put(recording);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Legacy update name wrapper
     */
    async updateRecordingName(id, name) {
        return this.updateRecordingMetadata(id, name, null);
    }

    /**
     * Save session metrics
     */
    async saveSession(sessionData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');

            const session = {
                date: new Date().toISOString(),
                duration: sessionData.duration,
                avgCentsDeviation: sessionData.avgCentsDeviation,
                timeInTune: sessionData.timeInTune,
                notesPracticed: sessionData.notesPracticed,
                mode: sessionData.mode
            };

            const request = store.add(session);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all sessions
     */
    async getAllSessions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get sessions within a date range
     */
    async getSessionsByDateRange(startDate, endDate) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const index = store.index('date');

            const range = IDBKeyRange.bound(startDate.toISOString(), endDate.toISOString());
            const request = index.getAll(range);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Export all data as JSON
     */
    async exportData() {
        const recordings = await this.getAllRecordings();
        const sessions = await this.getAllSessions();

        // Convert audio blobs to base64 for export
        const recordingsWithBase64 = await Promise.all(
            recordings.map(async (rec) => {
                if (rec.audioBlob) {
                    const base64 = await this.blobToBase64(rec.audioBlob);
                    return { ...rec, audioBlob: base64 };
                }
                return rec;
            })
        );

        return {
            recordings: recordingsWithBase64,
            sessions,
            exportDate: new Date().toISOString()
        };
    }

    /**
     * Helper: Convert blob to base64
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Get database storage estimate
     */
    async getStorageEstimate() {
        if (navigator.storage && navigator.storage.estimate) {
            return await navigator.storage.estimate();
        }
        return null;
    }

    /**
     * Clear all data (for testing/reset)
     */
    async clearAllData() {
        const stores = ['recordings', 'sessions', 'settings'];

        for (const storeName of stores) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }
}

// Export singleton instance
const dbManager = new DBManager();
