const mongoose = require('mongoose');

const nftSchema = new mongoose.Schema({
  tokenId: {
    type: String,
    required: true,
  },
  contractAddress: {
    type: String,
    required: true,
    index: true,
  },
  ownerAddress: {
    type: String,
    required: true,
    index: true,
  },
  metadataURI: {
    type: String,
    default: '',
  },
  image: {
    type: String,
    default: '',
  },
  transactionHash: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    enum: ['Loan NFT', 'Franchise NFT', 'Legion NFT', 'Loan', 'Franchise', 'Legion', 'RWA Barter', 'Gift NFT'],
    required: true,
  },
  attributes: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  isListed: {
    type: Boolean,
    default: false,
  },
  price: {
    type: String,
    default: '0',
  },
  sellerAddress: {
    type: String,
    default: '',
  },
  territory: {
    type: String,
    default: 'Global',
  },
  level: {
    type: Number,
    default: 1,
  },
  loanId: {
    type: String,
    default: '',
  },
  mintedAt: {
    type: Date,
    default: Date.now,
  },
  isAvailable: {
    type: Boolean,
    default: false,
  }
});

nftSchema.index({ ownerAddress: 1, type: 1 });

const NFT = mongoose.models.NFT || mongoose.model('NFT', nftSchema);

module.exports = NFT;
module.exports.default = NFT;
