const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['NFT Minted', 'NFT Sold', 'NFT Purchased', 'NFT Transferred', 'NFT Listed', 'NFT Delisted', 'System'],
    required: true,
  },
  tokenId: { type: String, default: '' },
  walletAddress: { type: String, default: '' },
  price: { type: String, default: '' },
  txHash: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

module.exports = Notification;
module.exports.default = Notification;