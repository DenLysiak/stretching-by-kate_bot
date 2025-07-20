import { Telegram } from 'telegraf';

export async function deletePreviousVideo(chatId: number, telegram: Telegram, lastVideoMessageMap: Map<number, number>) {
  const previousMessageId = lastVideoMessageMap.get(chatId);

  if (previousMessageId) {
    try {
      await telegram.deleteMessage(chatId, previousMessageId);

      lastVideoMessageMap.delete(chatId);
    } catch (err) {
      console.warn('⚠️ Не вдалося видалити попереднє відео:', err);
    }
  }
}