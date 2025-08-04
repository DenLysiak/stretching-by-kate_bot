import { Context } from "telegraf";

// Set to track recent menu clicks to prevent spam
const recentMenuClicks = new Set<number>();

export function debounceAction(handler: (ctx: Context) => Promise<void>, delay = 750) {
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
