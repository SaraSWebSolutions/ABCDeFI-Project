const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  tokenId: {
    type: String,
    required: true,
    index: true,
  },
  contractAddress: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    default: 'NFT',
  },
  eventType: {
    type: String,
    enum: ['Mint', 'Transfer', 'List', 'Cancel', 'Sale'],
    required: true,
  },
  from: {
    type: String,
    required: true,
  },
  to: {
    type: String,
    required: true,
  },
  price: {
    type: String,
    default: '0',
  },
  currency: {
    type: String,
    default: 'ABCD',
  },
  marketplaceFee: {
    type: String,
    default: '0',
  },
  royaltyFee: {
    type: String,
    default: '0',
  },
  txHash: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const NFTHistory = mongoose.models.NFTHistory || mongoose.model('NFTHistory', historySchema);

module.exports = NFTHistory;
module.exports.default = NFTHistory;
