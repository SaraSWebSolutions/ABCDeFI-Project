async function uploadToIPFS(metadata) {
  const hash = Math.random().toString(36).substring(2, 15);
  return `ipfs://Qm${hash}${Date.now()}`;
}

module.exports = { uploadToIPFS };
