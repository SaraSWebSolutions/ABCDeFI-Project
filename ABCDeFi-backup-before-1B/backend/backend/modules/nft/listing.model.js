const mongoose = require('mongoose');
const { CONTRACT_ADDRESSES } = require('../../config/contracts.cjs');

const listingSchema = new mongoose.Schema({
  listingId: {
    type: String,
    required: true,
    unique: true,
  },
  tokenId: {
    type: String,
    required: true,
  },
  contractAddress: {
    type: String,
    default: CONTRACT_ADDRESSES.LoanNFT,
  },
  sellerAddress: {
    type: String,
    required: true,
    lowercase: true,
  },
  type: {
    type: String,
    default: 'Loan NFT',
  },
  price: {
    type: String,
    required: true,
  },
  currency: {
    type: String,
    default: 'ABCD',
  },
  priceUsd: {
    type: Number,
    default: 0,
  },
  marketplaceFeeBps: {
    type: Number,
    default: 250,
  },
  royaltyFeeBps: {
    type: Number,
    default: 500,
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'cancelled'],
    default: 'active',
  },
  nftDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

const Listing = mongoose.models.Listing || mongoose.model('Listing', listingSchema);

module.exports = Listing;
module.exports.default = Listing;
