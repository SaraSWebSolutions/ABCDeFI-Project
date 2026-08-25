/**
 * GET /api/nfts
 * Legacy MongoDB NFT projections do not carry the canonical deployment
 * identity, so serving them here could mix stale network records into a
 * Hardhat-local session. The active frontend reads the deployed ERC-721
 * contracts directly until a chain-aware NFT indexer is available.
 */
exports.getAllNfts = async (_req, res) => res.status(503).json({
  success: false,
  message: 'The legacy NFT API is disabled because it is not chain-aware. Read the canonical deployed NFT contracts instead.',
});

exports.getAllNftsPublic = exports.getAllNfts;

exports.getMyNfts = async (req, res) => {
  const wallet = req.user?.walletAddress || req.user?.wallet || req.headers['x-wallet-address'];
  req.query.walletAddress = wallet;
  return exports.getAllNfts(req, res);
};

exports.getNFTByTypes = exports.getAllNfts;

/**
 * GET /api/nfts/user/:wallet
 */
exports.getNftsByUserWallet = exports.getAllNfts;

/**
 * GET /api/nfts/:tokenId
 */
exports.getNftByTokenId = exports.getAllNfts;

/**
 * POST /api/nfts
 * Creates a new NFT record in MongoDB (generic)
 */
exports.createNft = async (_req, res) => res.status(501).json({
  success: false,
  message: 'NFT minting must be submitted through the canonical on-chain contract flow. The API does not create simulated NFT records.',
});

/**
 * POST /api/nfts/loan
 */
exports.createLoanNft = exports.createNft;

/**
 * POST /api/nfts/franchise
 */
exports.createFranchiseNft = exports.createNft;

/**
 * POST /api/nfts/legion
 */
exports.createLegionNft = exports.createNft;

/**
 * GET /api/nfts/legion-hierarchy
 */
exports.getLegionHierarchy = exports.getAllNfts;
