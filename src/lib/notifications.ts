export async function createNotification(userId: string | number, title: string, message: string, link?: string) {
  const cleanUserId = String(userId).trim();
  console.log(`[NOTIFICATION] User: ${cleanUserId} | Title: ${title} | Message: ${message}`);

  return {
    id: String(Date.now()),
    userId: cleanUserId,
    title,
    message,
    link: link || null,
    isRead: false,
    createdAt: new Date(),
  };
}
