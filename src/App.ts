import { Markup, Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import * as fs from 'fs';
import { VideoType } from './types';
import { deletePreviousVideo } from './deletePreviousVideo';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN as string);
const videoList = JSON.parse(fs.readFileSync('./data/videoAPI.json', 'utf-8'));
const fileIdMap = new Map<string, string>();
const lastVideoMessageMap = new Map<number, number>();

bot.command('start', (ctx) => {
  return ctx.reply('Вітаю тебе у моїй авторській програмі онлайн-стретчингу! 🥳🎊\n\nЦе не просто набір вправ — це шлях до гнучкості, легкості рухів та гармонії з власним тілом. Програма складається з 6 відео, кожне з яких створене з любов’ю, знанням анатомії та розумінням потреб різного рівня підготовки.\n\nДо зустрічі на килимку!🧘🏼‍♀️\n\nЗ любов’ю,🫶🏼\nКатерина Горбань',
    Markup.inlineKeyboard([
      [Markup.button.callback('🤸🏼‍♀️ Розпочати тренування:', 'work_out')],
      [Markup.button.callback('✅ Переваги програми:', 'benefits')],
      [Markup.button.callback('🔹 Ця програма підійде:', 'about')],
      [Markup.button.callback('💫 Мотивація від мене:', 'motivation')],
  ]));
});

bot.action('work_out', (ctx) => {
  let videoCounter = 0;

  const videoButtons = videoList.map((video: VideoType) => {
      const shortId = `vid${videoCounter++}`;
      fileIdMap.set(shortId, video.fileId);

    return [Markup.button.callback(video.fileName, `play_video:${shortId}`)];
  });

  videoButtons.push([Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]);

  return ctx.editMessageText('Ось список відео для тренування:', Markup.inlineKeyboard(videoButtons));
});

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

bot.action('benefits', (ctx) => {
  return ctx.editMessageText('Переваги програми:\n\n✅ Поступова побудова гнучкості — без болю, надривів та зайвого стресу\n✅ Поєднання стретчингу та м’яких силових елементів — для здорових суглобів і м’язів\n✅ Пояснення техніки, дихання і безпечного входження у пози\n✅ Можна тренуватись у зручному темпі та комфортній атмосфері\n✅ Підходить для занять вдома, тобі знадобляться лише килимок, йога блоки та рушник.',
    Markup.inlineKeyboard([
      [Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
});

bot.action('about', (ctx) => {
  return ctx.editMessageText('Ця програма підійде: \n\n🔹 Початківцям, які хочуть безпечно почати розвивати гнучкість\n🔹 Тим, хто відчуває напруження у спині, ногах, тазі — і прагне покращити самопочуття\n🔹 Танцівникам, фітнес-ентузіастам, спортсменам як додаток до основного тренінгу\n🔹 Усім, хто мріє про шпагати, легке тіло й гарну поставу',
    Markup.inlineKeyboard([
      [Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
});

bot.action('motivation', (ctx) => {
  return ctx.editMessageText('Неважливо, з чого ти починаєш — важливо, що ти починаєш.\n\nТвоє тіло вже дякує тобі за цей крок. Розтягуючи м’язи, ти розширюєш свої межі — не лише фізично, а й внутрішньо. Подаруй собі цю подорож до себе. Ти заслуговуєш бути вільною/вільним у кожному русі 💫',
    Markup.inlineKeyboard([
      [Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
});

bot.action('return_to_menu', async (ctx) => {
    const chatId = ctx.chat?.id;

  if (chatId) {
    await deletePreviousVideo(chatId, ctx.telegram, lastVideoMessageMap);
  }

  return ctx.editMessageText('Вітаю тебе у моїй авторській програмі онлайн-стретчингу!\n\nЦе не просто набір вправ — це шлях до гнучкості, легкості рухів та гармонії з власним тілом. Програма складається з 6 відео, кожне з яких створене з любов’ю, знанням анатомії та розумінням потреб різного рівня підготовки.\n\nДо зустрічі на килимку!🧘🏼‍♀️\n\nЗ любов’ю,🫶🏼\nКатерина Горбань',
    Markup.inlineKeyboard([
      [Markup.button.callback('🤸🏼‍♀️ Розпочати тренування:', 'work_out')],
      [Markup.button.callback('✅ Переваги програми:', 'benefits')],
      [Markup.button.callback('🔹 Ця програма підійде:', 'about')],
      [Markup.button.callback('💫 Мотивація від мене:', 'motivation')],
  ]));
});

// Start the bot
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
