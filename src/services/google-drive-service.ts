/**
 * Google Drive Service for Frontend Applications
 * 
 * Usage:
 * 1. Initialize: const drive = new GoogleDriveService(config);
 * 2. Init scripts: await drive.init();
 * 3. Sign in: await drive.signIn();
 * 4. List PDFs: const files = await drive.listPDFs();
 * 5. Upload: await drive.uploadFile(file);
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const gapi: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

export interface DriveConfig {
    clientId: string;
    apiKey: string;
    folderId: string;
}

export interface DriveFile {
    id: string;
    name: string;
    createdTime?: string;
    modifiedTime?: string;
    webViewLink?: string;
    webContentLink?: string;
    thumbnailLink?: string;
    size?: string;
}

export interface UploadResult {
    id: string;
    name: string;
    webViewLink?: string;
}

interface TokenResponse {
    access_token: string;
    error?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    [key: string]: unknown;
}

interface TokenClient {
    callback: ((response: TokenResponse) => void) | null;
    requestAccessToken: (options: { prompt?: string }) => void;
}

export class GoogleDriveService {
    private clientId: string;
    private apiKey: string;
    private targetFolderId: string;
    private scopes: string;
    private tokenClient: TokenClient | null = null;
    private accessToken: string | null = null;

    constructor(config: DriveConfig) {
        this.clientId = config.clientId;
        this.apiKey = config.apiKey;
        this.targetFolderId = config.folderId;
        this.scopes = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly";
    }

    /**
     * Initialize Google API and Identity Services
     * Call this once when your app loads
     */
    async init(): Promise<void> {
        await Promise.all([
            this.loadScript('https://apis.google.com/js/api.js').then(() => this.initGapi()),
            this.loadScript('https://accounts.google.com/gsi/client').then(() => this.initGis())
        ]);
        // Attempt to restore token
        this.restoreToken();
    }

    /**
     * Check if user is currently signed in
     */
    isSignedIn(): boolean {
        return this.accessToken !== null;
    }

    /**
     * Trigger Google Sign-In popup
     * Returns the access token on success
     */
    signIn(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.tokenClient) {
                return reject(new Error("Drive Service not initialized. Call init() first."));
            }

            this.tokenClient.callback = (response: TokenResponse) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                this.accessToken = response.access_token;
                this.saveToken(response);
                resolve(this.accessToken);
            };

            // Check if already has token
            const existingToken = gapi.client.getToken();
            if (existingToken === null) {
                // First time - show consent screen
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                // Already authorized - skip consent
                this.tokenClient.requestAccessToken({ prompt: '' });
            }
        });
    }

    /**
     * Sign out and revoke token
     */
    signOut(): void {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
            gapi.client.setToken(null);
            this.accessToken = null;
        }
        localStorage.removeItem('gdrive_token');
    }

    /**
     * List all PDF files in the configured folder
     * @param pageSize - Number of files to fetch (default: 50)
     */
    async listPDFs(pageSize: number = 50, pageToken?: string, searchQuery?: string): Promise<{ files: DriveFile[], nextPageToken?: string }> {
        this.ensureSignedIn();

        // Base Query: files in target folder, PDF type, not trashed
        let query = `'${this.targetFolderId}' in parents and mimeType = 'application/pdf' and trashed = false`;

        // Append search filter if provided
        if (searchQuery) {
            // Escape single quotes to prevent query injection
            const safeQuery = searchQuery.replace(/'/g, "\\'");
            query += ` and name contains '${safeQuery}'`;
        }

        const response = await gapi.client.drive.files.list({
            pageSize: pageSize,
            pageToken: pageToken,
            fields: 'nextPageToken, files(id, name, createdTime, modifiedTime, webViewLink, webContentLink, thumbnailLink, size)',
            q: query,
            orderBy: 'modifiedTime desc'
        });

        return {
            files: response.result.files || [],
            nextPageToken: response.result.nextPageToken
        };
    }

    private saveToken(tokenObj: TokenResponse): void {
        const expiresIn = tokenObj.expires_in || 3599; // Default to 1 hour
        const expiresAt = Date.now() + (expiresIn * 1000);
        
        const storageData = {
            access_token: tokenObj.access_token,
            expires_at: expiresAt
        };
        
        localStorage.setItem('gdrive_token', JSON.stringify(storageData));
    }

    private restoreToken(): boolean {
        try {
            const stored = localStorage.getItem('gdrive_token');
            if (!stored) return false;

            const data = JSON.parse(stored);
            if (Date.now() >= data.expires_at) {
                // Token expired
                this.signOut();
                return false;
            }

            this.accessToken = data.access_token;
            // Restore to gapi client if initialized
            if (typeof gapi !== 'undefined' && gapi.client) {
                gapi.client.setToken({ access_token: this.accessToken });
            }
            return true;
        } catch (e) {
            console.error('Failed to restore token', e);
            return false;
        }
    }

    /**
     * List all files in the configured folder (not just PDFs)
     * @param pageSize - Number of files to fetch (default: 50)
     */
    async listAllFiles(pageSize: number = 50): Promise<DriveFile[]> {
        this.ensureSignedIn();

        const query = `'${this.targetFolderId}' in parents and trashed = false`;

        const response = await gapi.client.drive.files.list({
            pageSize: pageSize,
            fields: 'files(id, name, createdTime, modifiedTime, webViewLink, webContentLink, thumbnailLink, size, mimeType)',
            q: query,
            orderBy: 'modifiedTime desc'
        });

        return response.result.files || [];
    }

    /**
     * Upload a file to the configured folder
     * @param file - File object from input[type="file"]
     * @param customName - Optional custom name for the uploaded file
     */
    async uploadFile(file: File, customName?: string): Promise<UploadResult> {
        this.ensureSignedIn();

        const metadata = {
            name: customName || file.name,
            mimeType: file.type,
            parents: [this.targetFolderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
            {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + this.accessToken }),
                body: form,
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Delete a file by ID
     * @param fileId - The ID of the file to delete
     */
    async deleteFile(fileId: string): Promise<void> {
        this.ensureSignedIn();

        await gapi.client.drive.files.delete({
            fileId: fileId
        });
    }

    /**
     * Get file metadata
     * @param fileId - The ID of the file
     */
    async getFileMetadata(fileId: string): Promise<DriveFile> {
        this.ensureSignedIn();

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'id, name, createdTime, modifiedTime, webViewLink, webContentLink, thumbnailLink, size, mimeType'
        });

        return response.result;
    }

    // ==================== PRIVATE METHODS ====================

    private ensureSignedIn(): void {
        if (!this.accessToken) {
            throw new Error("Not signed in. Call signIn() first.");
        }
    }

    private loadScript(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    private async initGapi(): Promise<void> {
        await new Promise<void>((resolve) => {
            gapi.load('client', () => resolve());
        });

        await gapi.client.init({
            apiKey: this.apiKey,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });


    }

    private initGis(): void {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: this.scopes,
            callback: '', // Set at request time
        });


    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: string | number): string {
    const num = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (num === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return Math.round(num / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date to readable string
 */
export function formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
