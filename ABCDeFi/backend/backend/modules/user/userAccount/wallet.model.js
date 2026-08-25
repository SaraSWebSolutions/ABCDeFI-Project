const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAccount', required: true, unique: true },
  walletAddress: { type: String, required: true, unique: true, sparse: true },
  walletType: { type: String, enum: ['MetaMask', 'WalletConnect', 'TrustWallet', 'CoinbaseWallet'], required: true },
  chainId: { type: Number, required: true },
  verified: { type: Boolean, default: false },
  linkedAt: { type: Date, default: null },
  lastConnectedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Wallet', WalletSchema);
