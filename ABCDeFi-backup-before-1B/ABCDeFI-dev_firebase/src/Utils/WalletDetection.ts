import { Linking, Alert, Platform } from 'react-native';

export const WALLET_METADATA: Record<
  string,
  {
    name: string;
    scheme: string;
    packageId: string;
    playStoreUrl: string;
    appStoreUrl: string;
  }
> = {
  'io.metamask': {
    name: 'MetaMask',
    scheme: 'metamask://',
    packageId: 'io.metamask',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=io.metamask',
    appStoreUrl: 'https://apps.apple.com/app/metamask/id1438144202',
  },
  'com.trustwallet.app': {
    name: 'Trust Wallet',
    scheme: 'trust://wc',
    packageId: 'com.wallet.crypto.trustapp',
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp',
    appStoreUrl:
      'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409',
  },
  'me.rainbow': {
    name: 'Rainbow',
    scheme: 'rainbow://',
    packageId: 'me.rainbow',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=me.rainbow',
    appStoreUrl:
      'https://apps.apple.com/app/rainbow-ethereum-wallet/id1457119021',
  },
  'com.binance.wallet': {
    name: 'Binance Wallet',
    scheme: 'bnc://app.binance.com',
    packageId: 'com.binance.dev',
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.binance.dev',
    appStoreUrl:
      'https://apps.apple.com/app/binance-bitcoin-trading-wallet/id1436149926',
  },
  'app.phantom': {
    name: 'Phantom',
    scheme: 'phantom://',
    packageId: 'app.phantom',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=app.phantom',
    appStoreUrl:
      'https://apps.apple.com/app/phantantom-solana-wallet/id1598432997',
  },
};

export const checkWalletInstalled = async (
  walletId: string,
): Promise<boolean> => {
  const metadata = WALLET_METADATA[walletId];
  if (!metadata) {
    console.log(
      `[WalletCheck] No metadata for ${walletId}. Defaulting to true.`,
    );
    return true;
  }

  console.log(
    `[WalletCheck] Checking installation for: ${walletId} (${metadata.name})`,
  );

  try {
    const canOpen = await Linking.canOpenURL(metadata.scheme);
    console.log(
      `[WalletCheck] ${metadata.name} (${metadata.scheme}) -> ${canOpen}`,
    );
    return canOpen;
  } catch (error) {
    console.error(`Check installation error for ${walletId}:`, error);
    return false;
  }
};

export const showInstallationAlert = (walletId: string) => {
  const metadata = WALLET_METADATA[walletId];
  if (!metadata) {
    Alert.alert(
      'Wallet Not Found',
      'The selected wallet app is not installed on your device.',
    );
    return;
  }

  const isIOS = Platform.OS === 'ios';
  const storeUrl = isIOS ? metadata.appStoreUrl : metadata.playStoreUrl;
  const storeName = isIOS ? 'App Store' : 'Play Store';

  Alert.alert(
    `${metadata.name} Not Found`,
    `${metadata.name} is not installed. Install it from ${storeName}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Install',
        onPress: () => Linking.openURL(storeUrl),
      },
    ],
  );
};
