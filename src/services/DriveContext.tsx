import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { GoogleDriveService } from './google-drive-service';
import type { DriveFile, UploadResult } from './google-drive-service';
import { driveConfig } from './drive-config';

interface DriveContextType {
  driveService: GoogleDriveService;
  isInitialized: boolean;
  isSignedIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  uploadFile: (file: File, customName?: string) => Promise<UploadResult>;
  listPDFs: (pageSize?: number, pageToken?: string, searchQuery?: string) => Promise<{ files: DriveFile[], nextPageToken?: string }>;
  loading: boolean;
  error: string | null;
}

const DriveContext = createContext<DriveContextType | null>(null);

export function DriveProvider({ children }: { children: ReactNode }) {
  const [driveService] = useState(() => new GoogleDriveService(driveConfig));
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Drive on mount
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await driveService.init();
        setIsInitialized(true);
        setIsSignedIn(driveService.isSignedIn());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize Drive');
        console.error('Drive initialization error:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [driveService]);

  const signIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await driveService.signIn();
      setIsSignedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    driveService.signOut();
    setIsSignedIn(false);
  };

  const uploadFile = async (file: File, customName?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await driveService.uploadFile(file, customName);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listPDFs = async (pageSize?: number, pageToken?: string, searchQuery?: string) => {
    try {
      setError(null);
      return await driveService.listPDFs(pageSize, pageToken, searchQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list files');
      throw err;
    }
  };

  return (
    <DriveContext.Provider
      value={{
        driveService,
        isInitialized,
        isSignedIn,
        signIn,
        signOut,
        uploadFile,
        listPDFs,
        loading,
        error,
      }}
    >
      {children}
    </DriveContext.Provider>
  );
}

// Export the context for use in the useDrive hook
export { DriveContext };
