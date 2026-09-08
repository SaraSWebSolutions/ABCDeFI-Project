# ABCDeFi Local Real Registration Setup

1. Copy backend/backend/.env.example to backend/backend/.env and fill JWT_SECRET, JWT_REFRESH_SECRET, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER and SMTP_PASS. Keep DEBUG_OTP=false.
2. Start MongoDB at mongodb://127.0.0.1:27017/abcdefi. The backend no longer silently falls back to an in-memory database unless ALLOW_IN_MEMORY_DB=true.
3. Terminal 1 (project root): npx hardhat node
4. Terminal 2 (project root): npm run deploy:local
5. Terminal 3: cd backend/backend && npm run dev
6. Terminal 4 (project root): npm run dev
7. MetaMask: Hardhat Local, RPC http://127.0.0.1:8545, chain ID 31337, currency ETH.
8. Browser console: await window.ethereum.request({method:"eth_chainId"}) must return 0x7a69.
9. Register with a real email address. The backend generates a cryptographically secure six-digit OTP, stores only its SHA-256 hash, and sends the original OTP via SMTP. The OTP is not returned to the browser.
10. Enter the OTP from the email; then log in with the same credentials. With 2FA enabled, a second real OTP is sent by email.

Note: the repository still contains unrelated pre-existing TypeScript issues outside this auth/local-infrastructure scope, including missing @reduxjs/toolkit and several loan/NFT type mismatches.
