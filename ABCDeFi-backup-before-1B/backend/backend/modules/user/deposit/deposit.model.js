const mongoose = require('mongoose');

const DepositSchema = new mongoose.Schema({
  depositId: { type: String, required: true, unique: true }, // UUID
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAccount', required: true },
  walletAddress: { type: String, required: true },
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', default: null },
  token: { type: String, required: true }, // "ETH" or ERC20 address
  amount: { type: String, required: true }, // stored as string for precision
  usdValue: { type: String, required: true }, // pre-computed fiat value
  chainId: { type: Number, required: true },
  txHash: { type: String, required: true },
  blockNumber: { type: Number },
  status: {
    type: String,
    enum: ['Created','Pending','Confirmed','Locked','Released'],
    default: 'Created'
  },
  createdAt: { type: Date, default: Date.now },
  confirmedAt: { type: Date }
});

module.exports = mongoose.model('Deposit', DepositSchema);
