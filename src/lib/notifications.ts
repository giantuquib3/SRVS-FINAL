import { prisma } from './prisma';

export async function createNotification(userId: string, title: string, message: string, link?: string) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        link: link || null,
        isRead: false,
      },
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
}
