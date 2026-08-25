const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  loanId: {
    type: String,
    required: true,
    unique: true
  },
  borrowerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAccount',
    required: true
  },
  depositId: {
    type: String, // String because we used a random UUID for deposits previously
    ref: 'Deposit',
    required: true
  },
  collateralValue: {
    type: String,
    required: true
  },
  loanAmount: {
    type: String,
    required: true
  },
  interestRate: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true // duration in days
  },
  ltv: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Requested', 'Funded', 'Active', 'Defaulted', 'Repaid', 'Cancelled'],
    default: 'Requested'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  fundedAt: {
    type: Date
  }
});

const Loan = mongoose.model('Loan', loanSchema);
module.exports = Loan;
