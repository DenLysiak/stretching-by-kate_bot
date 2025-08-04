import { Markup, Telegraf } from 'telegraf';
import { ADMIN, db } from './App';
import { uploadDatabaseToDrive } from './googleDriveService';

// Interface representing a user in the allowed users list
export interface AllowedUser {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  date_added: string; // ISO 8601 date string
  permission_type: 'permanent' | 'temporary';
  end_date: string | null; // ISO date string or null if permanent
}

// Adds a user to the allowed users list if they do not already exist
// Returns a message indicating success or if the user already exists
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

// Removes a user from the allowed users list by user ID
// Returns true if the user was removed, false if the user was not found
export async function removeUser(userId: number): Promise<boolean> {
  const stmt = db.prepare('DELETE FROM allowed_users WHERE user_id = ?');
  const result = stmt.run(userId);

  if (result.changes > 0) {  
    await uploadDatabaseToDrive(); 

    return true;
  }

  return false;
}

// Deletes all expired users from the allowed users list
// Expired users are those with permission_type 'temporary' and end_date < current date
// Sends a message to the admin with the list of deleted users
export async function deleteExpiredUsers(bot: Telegraf): Promise<void> {
  const now = new Date().toISOString();

  const selectStmt = db.prepare(`
    SELECT * FROM allowed_users 
    WHERE permission_type = 'temporary' 
      AND end_date IS NOT NULL 
      AND end_date < ?
  `);
  const expiredUsers = selectStmt.all(now) as AllowedUser[];

  if (expiredUsers.length === 0) {
    console.log('✅ Немає прострочених користувачів.');
    return;
  }

  const deleteStmt = db.prepare(`
    DELETE FROM allowed_users 
    WHERE permission_type = 'temporary' 
      AND end_date IS NOT NULL 
      AND end_date < ?
  `);

  const result = deleteStmt.run(now);

  if (result.changes > 0) {
    await uploadDatabaseToDrive();
    
    const message = `🗑️ Видалено ${result.changes} користувачів із простроченим доступом:\n\n` +
      expiredUsers.map(u => `• ${u.first_name ?? ''} @${u.username ?? ''} (ID: ${u.user_id})`).join('\n');

    console.log(message);
    await bot.telegram.sendMessage(ADMIN, message);
  }
}

// Checks if a user is allowed to use the bot by user ID
// Returns true if the user is allowed, false otherwise
// If the user is not found in the allowed users list, they are not allowed
// This function is used to restrict access to the bot for unauthorized users
export async function isUserAllowed(userId: number): Promise<boolean> {
  const stmt = db.prepare('SELECT 1 FROM allowed_users WHERE user_id = ?');

  return !!stmt.get(userId);
}

// Retrieves all allowed users from the database
// Returns an array of AllowedUser objects
// This function is used to get the list of all users who have access to the bot
export async function getAllUsers(): Promise<AllowedUser[]> {
  const stmt = db.prepare('SELECT * FROM allowed_users');

  return stmt.all() as AllowedUser[];
}

// Notifies users with expiring access (10 days and 1 day before expiration)
// Sends a message to the user and the admin with the expiration details
// If the user has a temporary access that is expiring in 10 days or 1 day, they will receive a notification
// The admin will also be notified about the expiring users
export async function notifyExpiringUsers(bot: Telegraf): Promise<void> {
  const users = await getAllUsers();
  const now = new Date();

  for (const user of users) {
    if (user.permission_type !== 'temporary' || !user.end_date) continue;

    const endDate = new Date(user.end_date);
    const timeDiff = endDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysLeft !== 10 && daysLeft !== 1) continue;

    const endDateFormatted = endDate.toLocaleDateString('uk-UA');
    const notifyText = `⚠️ Ваш тимчасовий доступ до бота закінчується через ${daysLeft} дн${daysLeft === 1 ? 'ь' : 'ів'} (до ${endDateFormatted}).\n\nХочете подовжити доступ?`;

    // Повідомлення користувачу
    try {
      await bot.telegram.sendMessage(
        user.user_id,
        notifyText,
        Markup.inlineKeyboard([
          Markup.button.callback('🔁 Подовжити доступ', `request_extend_${user.user_id}`)
        ])
      );
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`❗ Не вдалося надіслати повідомлення користувачу ${user.user_id}:`, error.message);
      } else {
        console.warn(`❗ Не вдалося надіслати повідомлення користувачу ${user.user_id}:`, error);
      }
    }

    // Повідомлення адміну
    try {
      await bot.telegram.sendMessage(
        ADMIN,
        `🔔 Нагадування: доступ користувача @${user.username ?? 'невідомо'} (ID: ${user.user_id}) закінчується через ${daysLeft} дн${daysLeft === 1 ? 'ь' : 'ів'} (${endDateFormatted}).`
      );
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`❗ Не вдалося надіслати повідомлення адміну:`, error.message);
      } else {
        console.warn(`❗ Не вдалося надіслати повідомлення адміну:`, error);
      }
    }
  }
}
