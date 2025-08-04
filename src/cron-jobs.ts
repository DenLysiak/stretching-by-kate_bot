import cron, { ScheduledTask } from 'node-cron';
import * as fs from 'fs';
import { Telegraf } from 'telegraf';
import { deleteExpiredUsers, getAllUsers, notifyExpiringUsers } from './userServices';
import { MotivationType } from './types';

let deleteExpiredJob: ScheduledTask;
let notifyJob: ScheduledTask;
let motivationJob: ScheduledTask;

const motivationMessageList = JSON.parse(fs.readFileSync('./data/motivationAPI.json', 'utf-8'));

const asyncDeleteExpiredUsers = async (bot: Telegraf) => {
  try {
    console.log('🕛 Запускається перевірка прострочених користувачів...');
  
    await deleteExpiredUsers(bot);
  
    console.log('✅ Перевірка прострочених користувачів завершена.');
  } catch (error) {
    console.error('❌ Помилка під час видалення прострочених користувачів:', error);
  }
};

const asyncNotifyJob = async (bot: Telegraf) => {
  try {
    console.log('📬 Перевірка на користувачів із закінченням доступу...');
  
    await notifyExpiringUsers(bot);
  
    console.log('✅ Перевірка на користувачів із закінченням доступу завершена.');
  } catch (error) {
    console.error('❌ Помилка під час перевірки прострочених користувачів:', error);
  }
};

const asyncMotivationJob = async (bot: Telegraf) => {
  try {
    const users = await getAllUsers();
    const date = new Date().getDate();
  
    const motivationMessage = motivationMessageList.find((m: MotivationType) => m.messageId === date);
    const motivationText = motivationMessage?.messageText || 'Тягнись, поки не втягнешся. І тоді тягнись ще! 💫';
  
    for (const user of users) {
      bot.telegram.sendMessage(
      user.user_id,
      motivationText,
      { parse_mode: 'HTML' }
      ).catch(err => {
        console.error(`❗ Не вдалося надіслати нагадування користувачу ${user.user_id}:`, err);
      });
    }
  
    console.log('✅ Мотиваційне повідомлення розіслано');
  } catch (error) {
    console.error('❌ Помилка під час розсилки мотиваційних повідомлень:', error);
  }
};

export function startAllCronJobs(bot: Telegraf): void {
  // Every day at 00:00 check for expired users
  deleteExpiredJob = cron.schedule('0 11 * * *', () => asyncDeleteExpiredUsers(bot));

  // Every day at 09:00 notify users with expiring access
  notifyJob = cron.schedule('05 11 * * *', () => asyncNotifyJob(bot));

  // Every Monday, Wednesday, and Friday at 10:00 send motivation message
  motivationJob = cron.schedule('06 11 * * 1,3,5', () => asyncMotivationJob(bot));

  console.log('✅ Усі cron завдання запущено.');
}

export function stopAllCronJobs() {
  if (deleteExpiredJob) deleteExpiredJob.stop();
  if (notifyJob) notifyJob.stop();
  if (motivationJob) motivationJob.stop();

  console.log('❌ Усі cron завдання зупинено.');
}
