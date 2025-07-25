import { Context, Markup, Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import * as fs from 'fs';
import { VideoType } from './types';
import { deletePreviousVideo } from './deletePreviousVideo';
import { addUserIfNotExists, getAllUsers, isUserAllowed, removeUser } from './userServices';
import { sendWelcomeMessage } from './sendWelcome';
import path from 'path';
import { getDB, initDB } from '../data/db';
import Database from 'better-sqlite3';
import { downloadDatabaseFromDrive } from './googleDriveService';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN as string);
const videoList = JSON.parse(fs.readFileSync('./data/videoAPI.json', 'utf-8'));
const fileIdMap = new Map<string, string>();
const lastVideoMessageMap = new Map<number, number>();
const dbPath = path.resolve(__dirname, '../../data/users.db');

export let db: Database.Database;

// method to keep track of pending requests
const pendingRequests = new Map<number, { chatId: number, messageId: number }>();

// Set to track recent menu clicks to prevent spam
const recentMenuClicks = new Set<number>();

function debounceAction(handler: (ctx: Context) => Promise<void>, delay = 750) {
  return async (ctx: Context) => {
    const userId = ctx.from?.id;

    if (!userId) {
      return ctx.reply('❌ Не вдалося визначити ваш ID користувача.');
    }

    if (recentMenuClicks.has(userId)) {
      return ctx.answerCbQuery('⏳ Зачекай трохи...');
    }

    recentMenuClicks.add(userId);
    setTimeout(() => recentMenuClicks.delete(userId), delay);

    await ctx.answerCbQuery();

    await handler(ctx);
  };
}

const ADMIN = parseInt(process.env.ADMIN_OWNER_ID || '0', 10);

bot.command('start', async (ctx) => {
  const id = ctx.from.id;
  const username = ctx.from.username;

  if (isUserAllowed(id) || ADMIN === id) {
    return await sendWelcomeMessage(ctx);
  }

  ctx.reply(
    `⛔️ Доступ до бота закрито.\n🆔 Ваш user ID: <code>${id}</code>\nUsername: @${username || 'немає'}`,
    { parse_mode: 'HTML' }
  );

  const requestMsg = await ctx.reply(
    '🔐 Ви можете надіслати запит на доступ:',
    Markup.inlineKeyboard([
      Markup.button.callback('🔓 Запросити доступ', `request_access_${id}`)
    ])
  );

  pendingRequests.set(id, {
    chatId: ctx.chat.id,
    messageId: requestMsg.message_id
  });
});

bot.action(/request_access_(\d+)/, async (ctx) => {
  const requestedId = parseInt(ctx.match[1]);
  const from = ctx.from;

  if (requestedId !== from.id) {
    return ctx.reply('⚠️ Це не ваш запит.');
  }

  ctx.reply('📩 Запит надіслано адміністраторам.');

  bot.telegram.sendMessage(
    ADMIN,
    `📥 <b>Запит на доступ до бота:</b>\n\n👤 <b>Ім’я:</b> ${from.first_name} ${from.last_name || ''}\n🆔 <b>ID:</b> <code>${from.id}</code>\n🔗 <b>Username:</b> @${from.username || 'немає'}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Надати повний доступ', callback_data: `approve_${from.id}_permanent` }],
          [{ text: '✅ Надати доступ на 90 днів', callback_data: `approve_${from.id}_temporary` }],
          [{ text: '❌ Відхилити', callback_data: `reject_${from.id}` }]
        ]
      }
    }
    );
});

bot.action(/approve_(\d+)_(permanent|temporary)/, async (ctx) => {
  const adminId = ctx.from.id;
  if (ADMIN !== adminId) return ctx.reply('⛔️ Ви не адміністратор.');

  const userId = parseInt(ctx.match[1]);
  const permissionType = ctx.match[2] as 'permanent' | 'temporary';

  // Отримуємо чат користувача
  let chat;
  try {
    chat = await bot.telegram.getChat(userId);
  } catch (err) {
    console.error('❗ Не вдалося отримати чат користувача:', err);
    return ctx.reply('❌ Помилка при отриманні інформації про користувача.');
  }

  if (!chat || chat.type !== 'private') {
    return ctx.reply('❌ Неможливо додати — це не користувач.');
  }

  // Додаємо користувача до бази
  const result = await addUserIfNotExists({
    user_id: chat.id,
    first_name: chat.first_name,
    last_name: chat.last_name || null,
    username: chat.username || null,
    permission_type: permissionType,
    date_added: '',
    end_date: null
  });

  // Видаляємо повідомлення з кнопками, якщо воно є
  try {
    if (ctx.update.callback_query?.message) {
      const message = ctx.update.callback_query.message;

      await bot.telegram.deleteMessage(message.chat.id, message.message_id);
    }
  } catch (err: any) {
    console.warn('⚠️ Не вдалося видалити повідомлення з inline кнопками:', err);
  }

  // Видаляємо запит з очікування
  const userInfo = pendingRequests.get(userId);
  if (userInfo) {
    try {
      await bot.telegram.deleteMessage(userInfo.chatId, userInfo.messageId);
    } catch (e) {
      console.warn('⚠️ Не вдалося видалити запит користувача:', e instanceof Error ? e.message : e);
    }
    pendingRequests.delete(userId);
  }

  // Відповідь адміну
  await ctx.reply(result);

  // Повідомлення користувачу
  if (!result.includes('вже доданий')) {
    await bot.telegram.sendMessage(userId, '✅ Ваш доступ до бота підтверджено!');
    await sendWelcomeMessage(bot.telegram, userId);
  } else {
    await bot.telegram.sendMessage(userId, '⚠️ Ви вже маєте доступ до бота.');
  }
});

bot.command('users', async (ctx) => {
  if (ADMIN !== ctx.from.id) return ctx.reply('⛔️ Доступ заборонено.');

  const users = getAllUsers();

  if (users.length === 0) {
    return ctx.reply('🕵🏼‍♂️ Немає жодного користувача.');
  }

  for (const user of users) {
    const dateNormalized = user.date_added.split('T')[0];
    const endDateNormalized = user.end_date?.split('T')[0] || null;

    const text = `👤 <b>${user.first_name || ''} ${user.last_name || ''}</b>
      🆔 <code>${user.user_id}</code>
      🔗 @${user.username || 'немає'}
      🗓 Додано: ${dateNormalized}
      ⏳ Тип доступу: ${user.permission_type === 'temporary' ? 'на 90 днів' : 'назавжди'}
      ${user.end_date ? `📅 До: ${endDateNormalized}` : ''}`;

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: `❌ Видалити ${user.first_name || 'не вказано'} ${user.last_name || 'не вказано'}`, callback_data: `delete_user_${user.user_id}` }
        ]]
      }
    });
  }
});

bot.action(/delete_user_(\d+)/, async (ctx) => {
  if (ADMIN !== ctx.from.id) {
    return ctx.answerCbQuery('⛔️ Ви не адміністратор.');
  }

  const userId = parseInt(ctx.match[1]);
  const success = await removeUser(userId);

  if (success) {
    await ctx.answerCbQuery('✅ Користувача видалено');

    // Видалення повідомлення з кнопкою
    try {
      if (ctx.update.callback_query?.message) {
        const message = ctx.update.callback_query.message;
        await bot.telegram.deleteMessage(message.chat.id, message.message_id);
      }
    } catch (err) {
      console.error('❗ Не вдалося видалити повідомлення з кнопкою:', err);
    }

    // Повідомлення користувачу (опціонально)
    try {
      await bot.telegram.sendMessage(
        userId,
        '⛔️ Ваш доступ до бота було скасовано адміністратором.'
      );
    } catch (e) {
      // Якщо бот заблокований — ігноруємо
    }

    // Підтвердження адміну
    await ctx.reply(`❌ Користувач ${userId} видалений.`);
  } else {
    await ctx.answerCbQuery('⚠️ Користувач вже не має доступу або не знайдений.');
  }
});

bot.use(async (ctx, next) => {
  const username = ctx.from?.username;
  const userId = ctx.from?.id;

  if (!userId) {
    // Якщо немає info про користувача, просто пропускаємо
    return;
  }

  if (isUserAllowed(userId) || ADMIN === userId) {
    // Дозволяємо продовжувати обробку
    return next();
  } else {
    // Якщо доступ закрито
    await ctx.editMessageText(`⛔️ Доступ до бота закрито.\n🆔 Ваш user ID: <code>${userId}</code>\nUsername: @${username || 'немає'}`);
   
    const requestMsg = await ctx.reply(
      '🔐 Ви можете надіслати запит на доступ:',
      Markup.inlineKeyboard([
        Markup.button.callback('🔓 Запросити доступ', `request_access_${userId}`)
      ])
    );

  // Зберігаємо ID повідомлення в карту (щоб потім видалити)
    pendingRequests.set(userId, {
      chatId: ctx.chat!.id,
      messageId: requestMsg.message_id
    });
  }
});

bot.action('work_out', debounceAction(async (ctx) => {
  let videoCounter = 0;

  const videoButtons = videoList.map((video: VideoType) => {
      const shortId = `vid${videoCounter++}`;
      fileIdMap.set(shortId, video.fileId);

    return [Markup.button.callback(video.fileName, `play_video:${shortId}`)];
  });

  videoButtons.push([Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]);

  await ctx.editMessageText('Ось список відео для тренування:', Markup.inlineKeyboard(videoButtons));
}));

bot.action(/play_video:(.+)/, async (ctx) => {
  const shortId = ctx.match[1];
  const fileId = fileIdMap.get(shortId);
  const chatId = ctx.chat?.id;

  if (!fileId) {
    return ctx.reply('❌ Відео не знайдено.');
  }

  if (!chatId) {
    return ctx.reply('❌ Неможливо визначити чат.');
  }

  await ctx.answerCbQuery();

  await deletePreviousVideo(chatId, ctx.telegram, lastVideoMessageMap);


  const sendVideo = await ctx.replyWithVideo(fileId, {
    caption: 'Ось ваше тренування!',
  });

  lastVideoMessageMap.set(chatId, sendVideo.message_id);
});

bot.action('benefits', debounceAction(async (ctx) => {
    await ctx.editMessageText('Переваги програми:\n\n✅ Поступова побудова гнучкості — без болю, надривів та зайвого стресу\n✅ Поєднання стретчингу та м’яких силових елементів — для здорових суглобів і м’язів\n✅ Пояснення техніки, дихання і безпечного входження у пози\n✅ Можна тренуватись у зручному темпі та комфортній атмосфері\n✅ Підходить для занять вдома, тобі знадобляться лише килимок, йога блоки та рушник.',
    Markup.inlineKeyboard([
      [Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
}));

bot.action('about', debounceAction(async (ctx) => {
    await ctx.editMessageText('Ця програма підійде: \n\n🔹 Початківцям, які хочуть безпечно почати розвивати гнучкість\n🔹 Тим, хто відчуває напруження у спині, ногах, тазі — і прагне покращити самопочуття\n🔹 Танцівникам, фітнес-ентузіастам, спортсменам як додаток до основного тренінгу\n🔹 Усім, хто мріє про шпагати, легке тіло й гарну поставу',
    Markup.inlineKeyboard([
      [Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
}));

bot.action('motivation', debounceAction(async (ctx) => {
    await ctx.editMessageText('Неважливо, з чого ти починаєш — важливо, що ти починаєш.\n\nТвоє тіло вже дякує тобі за цей крок. Розтягуючи м’язи, ти розширюєш свої межі — не лише фізично, а й внутрішньо. Подаруй собі цю подорож до себе. Ти заслуговуєш бути вільною/вільним у кожному русі 💫',
    Markup.inlineKeyboard([
      [Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
}));

bot.action('return_to_menu', debounceAction(async (ctx) => {
  const chatId = ctx.chat?.id;

  if (chatId) {
    await deletePreviousVideo(chatId, ctx.telegram, lastVideoMessageMap);
  }

  const messageText =
    'Вітаю тебе у моїй авторській програмі онлайн-стретчингу! 🥳🎊\n\n' +
    'Це не просто набір вправ — це шлях до гнучкості, легкості рухів та гармонії з власним тілом. ' +
    'Програма складається з 6 відео, кожне з яких створене з любов’ю, знанням анатомії та розумінням потреб різного рівня підготовки.\n\n' +
    'До зустрічі на килимку!🧘🏼‍♀️\n\n' +
    'З любов’ю,🫶🏼\nКатерина Горбань';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🤸🏼‍♀️ Розпочати тренування:', 'work_out')],
    [Markup.button.callback('✅ Переваги програми:', 'benefits')],
    [Markup.button.callback('🔹 Ця програма підійде:', 'about')],
    [Markup.button.callback('💫 Мотивація від мене:', 'motivation')],
  ]);

  await ctx.editMessageText(messageText, keyboard);
}));

(async () => {
  try {
    console.log('🔽 Завантаження бази даних з Google Drive...');
    await downloadDatabaseFromDrive();
    console.log('✅ Базу даних завантажено.');
  } catch (err) {
    console.warn('⚠️ Не вдалося завантажити базу з Google Drive. Створюємо нову.');
    initDB(dbPath);
  }

  initDB(dbPath);

  db = getDB();

  await bot.launch();
  console.log('🤖 Бот запущено!');
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
