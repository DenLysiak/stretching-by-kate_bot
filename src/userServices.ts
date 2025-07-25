import { db } from './App';
import { uploadDatabaseToDrive } from './googleDriveService';

export interface AllowedUser {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  date_added: string; // ISO 8601 date string
  permission_type: 'permanent' | 'temporary';
  end_date: string | null; // ISO date string or null if permanent
}

export async function addUserIfNotExists(user: AllowedUser): Promise<string> {
  try {
    const check = db.prepare('SELECT user_id FROM allowed_users WHERE user_id = ?').get(user.user_id);

    if (check) {
      return `🔒 Користувач з ID ${user.user_id} вже доданий.`;
    }

    const now = new Date().toISOString();
    const endDate = user.permission_type === 'temporary'
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const insert = db.prepare(`
      INSERT INTO allowed_users 
        (user_id, first_name, last_name, username, date_added, permission_type, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      user.user_id,
      user.first_name ?? null,
      user.last_name ?? null,
      user.username ?? null,
      now,
      user.permission_type,
      endDate
    );

    await uploadDatabaseToDrive(); 

    return `✅ Користувача ${user.first_name ?? ''} успішно додано${user.permission_type === 'temporary' ? ' на 90 днів' : ' назавжди'}.`;
  } catch (err) {
    console.error('Error while adding user:', err);
    return '❌ Сталася помилка при додаванні користувача.';
  }
}

export async function removeUser(userId: number): Promise<boolean> {
  const stmt = db.prepare('DELETE FROM allowed_users WHERE user_id = ?');
  const result = stmt.run(userId);

  if (result.changes > 0) {  
    await uploadDatabaseToDrive(); 

    return true;
  }

  return false;
}

export function deleteExpiredUsers(): void {
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    DELETE FROM allowed_users 
    WHERE permission_type = 'temporary' 
      AND end_date IS NOT NULL 
      AND end_date < ?
  `);

  const result = stmt.run(now);
  console.log(`Expired users removed: ${result.changes}`);
}

export function isUserAllowed(userId: number): boolean {
  const stmt = db.prepare('SELECT 1 FROM allowed_users WHERE user_id = ?');

  return !!stmt.get(userId);
}

export function getAllUsers(): AllowedUser[] {
  const stmt = db.prepare('SELECT * FROM allowed_users');

  return stmt.all() as AllowedUser[];
}
