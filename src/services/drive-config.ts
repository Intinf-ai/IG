import type { DriveConfig } from './google-drive-service';

// Load credentials from environment variables
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '1lZS3Fc4JFLDot1CQ3OfmusTkQKuWV_nm';

// Validate that required environment variables are set
if (!CLIENT_ID || !API_KEY) {
  throw new Error(
    'Missing required environment variables. Please check your .env file and ensure VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY are set.'
  );
}

export const driveConfig: DriveConfig = {
  clientId: CLIENT_ID,
  apiKey: API_KEY,
  folderId: FOLDER_ID,
};
