export async function createNotification(userId: number | string, title: string, message: string, link?: string) {
  // Graceful in-app notification dispatcher (without dedicated table requirement)
  console.log(`[NOTIFICATION] User: ${userId} | Title: ${title} | Message: ${message}`);
  return {
    id: Date.now(),
    userId,
    title,
    message,
    link: link || null,
    isRead: false,
    createdAt: new Date(),
  };
}
