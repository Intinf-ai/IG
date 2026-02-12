import { initializeApp } from 'firebase/app';
import { getFirestore, doc, runTransaction, Firestore } from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db: Firestore = getFirestore(app);

console.log('✅ Firebase initialized -', { projectId: firebaseConfig.projectId });

/**
 * Gets the next sequential invoice number using Firestore transaction
 * Ensures atomic increment - no duplicate numbers even with concurrent requests
 * @returns Promise<number> - Next invoice number (1, 2, 3, etc.)
 */
export async function getNextInvoiceNumber(): Promise<number> {
    console.log('📝 Getting next invoice number...');
    const counterRef = doc(db, 'counters', 'invoiceNumber');

    try {
        const newNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            // Get current number or start from 0
            const currentNumber = counterDoc.exists()
                ? (counterDoc.data().current as number)
                : 0;

            console.log('Current invoice number:', currentNumber);

            // Increment to get next number
            const nextNumber = currentNumber + 1;

            console.log('Next invoice number:', nextNumber);

            // Update counter with new value and timestamp
            transaction.set(counterRef, {
                current: nextNumber,
                lastUpdated: new Date().toISOString()
            });

            return nextNumber;
        });

        console.log('✅ Invoice number generated:', newNumber);
        return newNumber;
    } catch (error) {
        console.error('❌ Error getting next invoice number:', error);
        throw new Error('Failed to generate invoice number. Please try again.');
    }
}

/**
 * Formats invoice number with leading zeros
 * @param number - Invoice number (e.g., 1, 2, 123)
 * @returns Formatted string (e.g., "#00001", "#00002", "#00123")
 */
export function formatInvoiceNumber(number: number): string {
    return `#${number.toString().padStart(5, '0')}`;
}

/**
 * Gets and formats the next invoice number
 * @returns Promise<string> - Formatted invoice number (e.g., "#00001")
 */
export async function getFormattedInvoiceNumber(): Promise<string> {
    const number = await getNextInvoiceNumber();
    const formatted = formatInvoiceNumber(number);
    console.log('🔢 Formatted invoice number:', formatted);
    return formatted;
}
