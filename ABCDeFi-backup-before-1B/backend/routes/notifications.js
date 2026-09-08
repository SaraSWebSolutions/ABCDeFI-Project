import express from 'express';

const router = express.Router();

// Mock initial notification store for UI development
let mockNotifications = [
  {
    id: 'notif-101',
    title: 'Loan Disbursed',
    message: 'Your loan application LOAN-8402 for 5,000 ABCD has been funded and disbursed to your wallet.',
    type: 'loan',
    read: false,
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'notif-102',
    title: 'NFT Listing Purchased',
    message: 'Your Franchise NFT #202 (Singapore Hub) was purchased for 10,000 ABCD.',
    type: 'marketplace',
    read: false,
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'notif-103',
    title: 'KYC Verification Approved',
    message: 'Your Level 2 Identity Verification has been approved by compliance system.',
    type: 'kyc',
    read: true,
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'notif-104',
    title: 'Staking Reward Distributed',
    message: 'You received 125.5 ABCD in staking yields for Legion Commander NFT.',
    type: 'reward',
    read: true,
    timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
];

/**
 * 1. GET /api/notifications
 * Fetch user notifications
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    count: mockNotifications.length,
    unreadCount: mockNotifications.filter((n) => !n.read).length,
    notifications: mockNotifications,
  });
});

/**
 * 2. POST /api/notifications/mark-read/:id
 * Mark a single notification as read
 */
router.post('/mark-read/:id', (req, res) => {
  const { id } = req.params;
  const notif = mockNotifications.find((n) => n.id === id);
  if (notif) {
    notif.read = true;
  }
  res.json({
    success: true,
    message: `Notification ${id} marked as read`,
    notifications: mockNotifications,
  });
});

/**
 * 3. POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', (req, res) => {
  mockNotifications.forEach((n) => (n.read = true));
  res.json({
    success: true,
    message: 'All notifications marked as read',
    notifications: mockNotifications,
  });
});

/**
 * 4. POST /api/notifications/clear
 * Clear all notifications
 */
router.post('/clear', (req, res) => {
  mockNotifications = [];
  res.json({
    success: true,
    message: 'All notifications cleared',
    notifications: [],
  });
});

/**
 * 5. POST /api/notifications/clear-notification/:id
 * Remove a specific notification
 */
router.post('/clear-notification/:id', (req, res) => {
  const { id } = req.params;
  mockNotifications = mockNotifications.filter((n) => n.id !== id);
  res.json({
    success: true,
    message: `Notification ${id} removed`,
    notifications: mockNotifications,
  });
});

export default router;
