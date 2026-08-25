import React, { useState } from 'react';
import CreateLoanModal from './CreateLoanModal';

const LoanCreationFlow: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Create a New Loan</h1>
      <button
        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded hover:opacity-90"
        onClick={() => setShowModal(true)}
      >
        New Loan Request
      </button>
      {showModal && <CreateLoanModal onClose={() => setShowModal(false)} />}
    </div>
  );
};

export default LoanCreationFlow;
