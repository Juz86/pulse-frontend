import { clearStoredAttachments, getMockStorageDir } from '../services/attachmentStorage.js';

try {
  await clearStoredAttachments();
  console.log(`Lokale mock-attachments verwijderd uit ${getMockStorageDir()}.`);
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
