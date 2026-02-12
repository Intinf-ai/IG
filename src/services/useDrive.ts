import { useContext } from 'react';
import { DriveContext } from './DriveContext';

export function useDrive() {
  const context = useContext(DriveContext);
  if (!context) {
    throw new Error('useDrive must be used within DriveProvider');
  }
  return context;
}
