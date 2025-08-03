"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN = exports.db = void 0;
const telegraf_1 = require("telegraf");
const dotenv_1 = __importDefault(require("dotenv"));
const fs = __importStar(require("fs"));
const deletePreviousVideo_1 = require("./deletePreviousVideo");
const userServices_1 = require("./userServices");
const sendWelcome_1 = require("./sendWelcome");
const path_1 = __importDefault(require("path"));
const db_1 = require("../data/db");
const googleDriveService_1 = require("./googleDriveService");
const getRandomNum_1 = require("./getRandomNum");
const node_cron_1 = __importDefault(require("node-cron"));
dotenv_1.default.config();
const bot = new telegraf_1.Telegraf(process.env.BOT_TOKEN);
const videoList = JSON.parse(fs.readFileSync('./data/videoAPI.json', 'utf-8'));
const motivationMessageList = JSON.parse(fs.readFileSync('./data/motivationAPI.json', 'utf-8'));
const fileIdMap = new Map();
const lastVideoMessageMap = new Map();
const dbPath = path_1.default.resolve(__dirname, '../../data/users.db');
// method to keep track of pending requests
const pendingRequests = new Map();
// Set to track recent menu clicks to prevent spam
const recentMenuClicks = new Set();
function debounceAction(handler, delay = 750) {
    return async (ctx) => {
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
exports.ADMIN = parseInt(process.env.ADMIN_OWNER_ID || '0', 10);
// Every day at 00:00 check for expired users
const deleteExpiredJob = node_cron_1.default.schedule('0 0 * * *', async () => {
    try {
        console.log('🕛 Запускається перевірка прострочених користувачів...');
        await (0, userServices_1.deleteExpiredUsers)(bot);
        console.log('✅ Перевірка прострочених користувачів завершена.');
    }
    catch (error) {
        console.error('❌ Помилка під час видалення прострочених користувачів:', error);
    }
});
// Every day at 09:00 notify users with expiring access
const notifyJob = node_cron_1.default.schedule('0 9 * * *', async () => {
    try {
        console.log('📬 Перевірка на користувачів із закінченням доступу...');
        await (0, userServices_1.notifyExpiringUsers)(bot);
        console.log('✅ Перевірка на користувачів із закінченням доступу завершена.');
    }
    catch (error) {
        console.error('❌ Помилка під час перевірки прострочених користувачів:', error);
    }
});
// Every Monday, Wednesday, and Friday at 10:00 send motivation message
const motivationJob = node_cron_1.default.schedule('0 10 * * 1, 3, 5', async () => {
    try {
        const users = await (0, userServices_1.getAllUsers)();
        const date = new Date().getDate();
        const motivationMessage = motivationMessageList.find((m) => m.messageId === date);
        const motivationText = motivationMessage?.messageText || 'Тягнись, поки не втягнешся. І тоді тягнись ще! 💫';
        for (const user of users) {
            bot.telegram.sendMessage(user.user_id, motivationText, { parse_mode: 'HTML' }).catch(err => {
                console.error(`❗ Не вдалося надіслати нагадування користувачу ${user.user_id}:`, err);
            });
        }
        console.log('✅ Мотиваційне повідомлення розіслано');
    }
    catch (error) {
        console.error('❌ Помилка під час розсилки мотиваційних повідомлень:', error);
    }
});
function stopAllCronJobs() {
    deleteExpiredJob.stop();
    notifyJob.stop();
    motivationJob.stop();
    console.log('🛑 Усі cron завдання зупинено.');
}
bot.command('start', async (ctx) => {
    const id = ctx.from.id;
    const username = ctx.from.username;
    const isAllowed = await (0, userServices_1.isUserAllowed)(id);
    if (isAllowed || exports.ADMIN === id) {
        return await (0, sendWelcome_1.sendWelcomeMessage)(ctx);
    }
    ctx.reply(`⛔️ Доступ до бота закрито.\n🆔 Ваш user ID: <code>${id}</code>\nUsername: @${username || 'немає'}`, { parse_mode: 'HTML' });
    const requestMsg = await ctx.reply('🔐 Ви можете надіслати запит на доступ:', telegraf_1.Markup.inlineKeyboard([
        telegraf_1.Markup.button.callback('🔓 Запросити доступ', `request_access_${id}`)
    ]));
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
    bot.telegram.sendMessage(exports.ADMIN, `📥 <b>Запит на доступ до бота:</b>\n\n👤 <b>Ім’я:</b> ${from.first_name} ${from.last_name || ''}\n🆔 <b>ID:</b> <code>${from.id}</code>\n🔗 <b>Username:</b> @${from.username || 'немає'}`, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ Надати повний доступ', callback_data: `approve_${from.id}_permanent` }],
                [{ text: '✅ Надати доступ на 90 днів', callback_data: `approve_${from.id}_temporary` }],
                [{ text: '❌ Відхилити', callback_data: `reject_${from.id}` }]
            ]
        }
    });
});
bot.action(/approve_(\d+)_(permanent|temporary)/, async (ctx) => {
    const adminId = ctx.from.id;
    if (exports.ADMIN !== adminId)
        return ctx.reply('⛔️ Ви не адміністратор.');
    const userId = parseInt(ctx.match[1]);
    const permissionType = ctx.match[2];
    // Отримуємо чат користувача
    let chat;
    try {
        chat = await bot.telegram.getChat(userId);
    }
    catch (err) {
        console.error('❗ Не вдалося отримати чат користувача:', err);
        return ctx.reply('❌ Помилка при отриманні інформації про користувача.');
    }
    if (!chat || chat.type !== 'private') {
        return ctx.reply('❌ Неможливо додати — це не користувач.');
    }
    // Додаємо користувача до бази
    const result = await (0, userServices_1.addUserIfNotExists)({
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
    }
    catch (err) {
        console.warn('⚠️ Не вдалося видалити повідомлення з inline кнопками:', err);
    }
    // Видаляємо запит з очікування
    const userInfo = pendingRequests.get(userId);
    if (userInfo) {
        try {
            await bot.telegram.deleteMessage(userInfo.chatId, userInfo.messageId);
        }
        catch (e) {
            console.warn('⚠️ Не вдалося видалити запит користувача:', e instanceof Error ? e.message : e);
        }
        pendingRequests.delete(userId);
    }
    // Відповідь адміну
    await ctx.reply(result);
    // Повідомлення користувачу
    if (!result.includes('вже доданий')) {
        await bot.telegram.sendMessage(userId, '✅ Ваш доступ до бота підтверджено!');
        await (0, sendWelcome_1.sendWelcomeMessage)(bot.telegram, userId);
    }
    else {
        await bot.telegram.sendMessage(userId, '⚠️ Ви вже маєте доступ до бота.');
    }
});
bot.action(/^request_extend_(\d+)$/, async (ctx) => {
    const userId = Number(ctx.match[1]);
    if (ctx.from.id !== userId) {
        return ctx.answerCbQuery('⛔ Це не ваше повідомлення.');
    }
    await ctx.answerCbQuery('⏳ Запит надіслано адміну.');
    await bot.telegram.sendMessage(exports.ADMIN, `📨 Користувач @${ctx.from.username ?? 'без імені'} (ID: ${userId}) просить подовжити доступ.`, telegraf_1.Markup.inlineKeyboard([
        telegraf_1.Markup.button.callback('✅ Подовжити на 90 днів', `approve_extend_${userId}`),
        telegraf_1.Markup.button.callback('❌ Відмовити', `deny_extend_${userId}`)
    ]));
});
bot.action(/^approve_extend_(\d+)$/, async (ctx) => {
    const userId = Number(ctx.match[1]);
    const newEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const stmt = exports.db.prepare(`UPDATE allowed_users SET end_date = ? WHERE user_id = ?`);
    stmt.run(newEndDate, userId);
    await ctx.editMessageText(`✅ Доступ користувачу (ID: ${userId}) подовжено до ${new Date(newEndDate).toLocaleDateString('uk-UA')}.`);
    await bot.telegram.sendMessage(userId, `✅ Ваш доступ подовжено на 90 днів!`);
    await (0, googleDriveService_1.uploadDatabaseToDrive)();
});
bot.action(/^deny_extend_(\d+)$/, async (ctx) => {
    const userId = Number(ctx.match[1]);
    await ctx.editMessageText(`❌ Відмовлено у подовженні доступу користувачу (ID: ${userId}).`);
    await bot.telegram.sendMessage(userId, `❌ Адміністратор відмовив у подовженні доступу.`);
});
bot.command('users', async (ctx) => {
    if (exports.ADMIN !== ctx.from.id)
        return ctx.reply('⛔️ Доступ заборонено.');
    const users = await (0, userServices_1.getAllUsers)();
    if (users.length === 0) {
        return ctx.reply('🕵🏼‍♂️ Немає жодного користувача.');
    }
    for (const user of users) {
        const dateNormalized = user.date_added.split('T')[0] || new Date().toLocaleDateString('uk-UA');
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
    if (exports.ADMIN !== ctx.from.id) {
        return ctx.answerCbQuery('⛔️ Ви не адміністратор.');
    }
    const userId = parseInt(ctx.match[1]);
    const success = await (0, userServices_1.removeUser)(userId);
    if (success) {
        await ctx.answerCbQuery('✅ Користувача видалено');
        // Видалення повідомлення з кнопкою
        try {
            if (ctx.update.callback_query?.message) {
                const message = ctx.update.callback_query.message;
                await bot.telegram.deleteMessage(message.chat.id, message.message_id);
            }
        }
        catch (err) {
            console.error('❗ Не вдалося видалити повідомлення з кнопкою:', err);
        }
        // Повідомлення користувачу (опціонально)
        try {
            await bot.telegram.sendMessage(userId, '⛔️ Ваш доступ до бота було скасовано адміністратором.');
        }
        catch (e) {
            // Якщо бот заблокований — ігноруємо
        }
        // Підтвердження адміну
        await ctx.reply(`❌ Користувач ${userId} видалений.`);
    }
    else {
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
    const isAllowed = await (0, userServices_1.isUserAllowed)(userId);
    if (isAllowed || exports.ADMIN === userId) {
        // Дозволяємо продовжувати обробку
        return next();
    }
    else {
        // Якщо доступ закрито
        await ctx.editMessageText(`⛔️ Доступ до бота закрито.\n🆔 Ваш user ID: <code>${userId}</code>\nUsername: @${username || 'немає'}`);
        const requestMsg = await ctx.reply('🔐 Ви можете надіслати запит на доступ:', telegraf_1.Markup.inlineKeyboard([
            telegraf_1.Markup.button.callback('🔓 Запросити доступ', `request_access_${userId}`)
        ]));
        // Зберігаємо ID повідомлення в карту (щоб потім видалити)
        pendingRequests.set(userId, {
            chatId: ctx.chat.id,
            messageId: requestMsg.message_id
        });
    }
});
bot.action('work_out', debounceAction(async (ctx) => {
    let videoCounter = 0;
    const videoButtons = videoList.map((video) => {
        const shortId = `vid${videoCounter++}`;
        fileIdMap.set(shortId, video.fileId);
        return [telegraf_1.Markup.button.callback(video.fileName, `play_video:${shortId}`)];
    });
    videoButtons.push([telegraf_1.Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]);
    await ctx.editMessageText('Ось список відео для тренування:', telegraf_1.Markup.inlineKeyboard(videoButtons));
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
    await (0, deletePreviousVideo_1.deletePreviousVideo)(chatId, ctx.telegram, lastVideoMessageMap);
    const sendVideo = await ctx.replyWithVideo(fileId, {
        caption: 'Ось ваше тренування!',
        protect_content: true,
        supports_streaming: true,
    });
    lastVideoMessageMap.set(chatId, sendVideo.message_id);
});
bot.action('benefits', debounceAction(async (ctx) => {
    await ctx.editMessageText('Переваги програми:\n\n✅ Поступова побудова гнучкості — без болю, надривів та зайвого стресу\n✅ Поєднання стретчингу та м’яких силових елементів — для здорових суглобів і м’язів\n✅ Пояснення техніки, дихання і безпечного входження у пози\n✅ Можна тренуватись у зручному темпі та комфортній атмосфері\n✅ Підходить для занять вдома, тобі знадобляться лише килимок, йога блоки та рушник.', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
}));
bot.action('about', debounceAction(async (ctx) => {
    await ctx.editMessageText('Ця програма підійде: \n\n🔹 Початківцям, які хочуть безпечно почати розвивати гнучкість\n🔹 Тим, хто відчуває напруження у спині, ногах, тазі — і прагне покращити самопочуття\n🔹 Танцівникам, фітнес-ентузіастам, спортсменам як додаток до основного тренінгу\n🔹 Усім, хто мріє про шпагати, легке тіло й гарну поставу', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
}));
bot.action('motivation', debounceAction(async (ctx) => {
    const randomNumber = (0, getRandomNum_1.getRandomNumber)(1, motivationMessageList.length);
    const message = [...motivationMessageList].find((m) => m.messageId === randomNumber);
    await ctx.editMessageText(`${message.messageText ? message.messageText : 'Тягнись, поки не втягнешся. І тоді тягнись ще!'} 💫`, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
}));
bot.action('return_to_menu', debounceAction(async (ctx) => {
    const chatId = ctx.chat?.id;
    if (chatId) {
        await (0, deletePreviousVideo_1.deletePreviousVideo)(chatId, ctx.telegram, lastVideoMessageMap);
    }
    const messageText = 'Вітаю тебе у моїй авторській програмі онлайн-стретчингу! 🥳🎊\n\n' +
        'Це не просто набір вправ — це шлях до гнучкості, легкості рухів та гармонії з власним тілом. ' +
        'Програма складається з 6 відео, кожне з яких створене з любов’ю, знанням анатомії та розумінням потреб різного рівня підготовки.\n\n' +
        'До зустрічі на килимку!🧘🏼‍♀️\n\n' +
        'З любов’ю,🫶🏼\nКатерина Горбань';
    const keyboard = telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🤸🏼‍♀️ Розпочати тренування:', 'work_out')],
        [telegraf_1.Markup.button.callback('✅ Переваги програми:', 'benefits')],
        [telegraf_1.Markup.button.callback('🔹 Ця програма підійде:', 'about')],
        [telegraf_1.Markup.button.callback('💫 Мотивація від мене:', 'motivation')],
    ]);
    await ctx.editMessageText(messageText, keyboard);
}));
// Initialize the database and download from Google Drive if available
// If the download fails, it will create a new database
// This is done to ensure the bot has a fresh database to work with
(async () => {
    try {
        console.log('🔽 Завантаження бази даних з Google Drive...');
        await (0, googleDriveService_1.downloadDatabaseFromDrive)();
    }
    catch (err) {
        console.warn('⚠️ Не вдалося завантажити базу з Google Drive. Створюємо нову.');
        (0, db_1.initDB)(dbPath);
    }
    (0, db_1.initDB)(dbPath);
    exports.db = (0, db_1.getDB)();
    await bot.launch();
    console.log('🤖 Бот запущено!');
})();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', async () => {
    console.log('Received SIGTERM signal. Initiating graceful shutdown...');
    stopAllCronJobs();
    try {
        await bot.stop('SIGTERM');
        console.log('Bot and cron jobs have been stopped.');
        process.exit(0);
    }
    catch (error) {
        console.error('Error during bot shutdown:', error);
        process.exit(1);
    }
});
//# sourceMappingURL=App.js.map