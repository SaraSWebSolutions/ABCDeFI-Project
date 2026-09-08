const express = require('express');
const router = express.Router();
const nftController = require('./nft.controller');
const auth = require("../../middleware/authMiddleware");
const { requireAdmin } = require("../../middleware/authMiddleware");

// Public NFT Catalog Endpoints (No Auth Required for Marketplace Browsing)
router.get('/all', nftController.getAllNftsPublic);
router.get('/catalog', nftController.getAllNftsPublic);
router.get('/legion-hierarchy', nftController.getLegionHierarchy);
router.get('/user/:wallet', nftController.getNftsByUserWallet);

// Authenticated User & Filtered NFT Endpoints
router.get('/my', auth, nftController.getMyNfts);
router.get('/filter', auth, nftController.getNFTByTypes);
router.get('/', auth, nftController.getAllNfts);
router.get('/:tokenId', nftController.getNftByTokenId);

// Creation / Minting Endpoints
router.post('/', auth, requireAdmin, nftController.createNft);
router.post('/loan', auth, requireAdmin, nftController.createLoanNft);
router.post('/franchise', auth, requireAdmin, nftController.createFranchiseNft);
router.post('/mint-franchise', auth, requireAdmin, nftController.createFranchiseNft);
router.post('/legion', auth, requireAdmin, nftController.createLegionNft);
router.post('/mint-legion', auth, requireAdmin, nftController.createLegionNft);

module.exports = router;
