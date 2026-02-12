import { GoogleDriveService } from '../services/google-drive-service';
import type { DriveFile } from '../services/google-drive-service';
import { driveConfig } from '../services/drive-config';

export type { DriveFile };

// Singleton instance of the Drive service
let driveServiceInstance: GoogleDriveService | null = null;

const getDriveService = () => {
  if (!driveServiceInstance) {
    driveServiceInstance = new GoogleDriveService(driveConfig);
  }
  return driveServiceInstance;
};

/**
 * List all invoice PDFs from Google Drive
 */
export const listInvoices = async (): Promise<DriveFile[]> => {
  const driveService = getDriveService();

  // Check if service is initialized
  if (!driveService.isSignedIn()) {
    // Return empty array if not signed in
    // The component will handle sign-in
    return [];
  }

  try {
    const result = await driveService.listPDFs();
    return result.files;
  } catch (error) {
    console.error('Failed to list invoices:', error);
    return [];
  }
};
