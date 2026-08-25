// src/services/notificationService.ts
import Notification from '../models/Notification';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

const env = (import.meta as any).env || {};

// Simple email transporter (configure via env)
const transporter = nodemailer.createTransport({
  host: env.VITE_SMTP_HOST || env.SMTP_HOST,
  port: Number(env.VITE_SMTP_PORT || env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: env.VITE_SMTP_USER || env.SMTP_USER,
    pass: env.VITE_SMTP_PASS || env.SMTP_PASS,
  },
});

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  category: NotificationAttributes['category']
) => {
  const notif = await Notification.create({
    id: uuidv4(),
    userId,
    title,
    message,
    category,
    status: 'UNREAD',
  });
  // Send email (if enabled)
  if ((env.VITE_ENABLE_EMAIL || env.ENABLE_EMAIL) === 'true') {
    await transporter.sendMail({
      from: env.VITE_EMAIL_FROM || env.EMAIL_FROM,
      to: userId, // assuming wallet address maps to email elsewhere
      subject: title,
      text: message,
    });
  }
  return notif;
};

export const markAsRead = async (id: string) => {
  const notif = await Notification.findByPk(id);
  if (notif && notif.status === 'UNREAD') {
    notif.status = 'READ';
    notif.readAt = new Date();
    await notif.save();
  }
  return notif;
};

export const markAllAsRead = async (userId: string) => {
  await Notification.update({ status: 'READ', readAt: new Date() }, { where: { userId, status: 'UNREAD' } });
};

export const archiveNotification = async (id: string) => {
  const notif = await Notification.findByPk(id);
  if (notif) {
    notif.status = 'ARCHIVED';
    await notif.save();
  }
  return notif;
};
