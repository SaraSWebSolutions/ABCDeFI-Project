import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useWalletImage } from 'thirdweb/react';
import Fonts from '../Utils/Fonts';




interface WalletModalProps {
  visible: boolean;
  onClose: () => void;
  onWalletConnect: (walletId: string) => Promise<void>;
}


const WalletOption: React.FC<{
  walletId: string;
  walletName: string;
  walletIcon: string;
  onPress: () => void;
  isLoading: boolean;
}> = ({ walletId, walletName, walletIcon, onPress, isLoading }) => {
  const { data: walletImage } = useWalletImage(walletId === 'walletConnect' ? null : walletIcon as any);

  const displayIcon = walletId === 'walletConnect'
    ? require('../assets/Walletconnect-logo.png')
    : walletImage ? { uri: walletImage } : null;

  return (
    <View style={styles.optionContainer}>
      <TouchableOpacity
        style={styles.walletOption}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={isLoading}
      >
        <View style={styles.walletIconContainer}>
          {displayIcon ? (
            <Image source={displayIcon} style={styles.walletIcon} />
          ) : (
            <View style={[styles.walletIcon, styles.placeholderIcon]} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.walletName}>{walletName}</Text>
          {walletId === 'walletConnect' && (
            <Text style={styles.walletNote}>Connect other installed wallets</Text>
          )}
        </View>
        {isLoading && (
          <ActivityIndicator
            size="large"
            color="#fff"
            style={styles.loader}
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

export const WalletModal: React.FC<WalletModalProps> = ({
  visible,
  onClose,
  onWalletConnect,
}) => {
  const [connectingWallet, setConnectingWallet] = React.useState<string | null>(
    null,
  );

  const handleWalletPress = async (walletId: string, walletName: string) => {
    try {
      setConnectingWallet(walletId);
      await onWalletConnect(walletId);
      onClose();
    } catch (error) {
      console.error('Wallet connection error:', error);
    } finally {
      setConnectingWallet(null);
    }
  };

  const wallets = [
    { id: 'io.metamask', name: 'MetaMask', icon: 'io.metamask' },
    {
      id: 'com.trustwallet.app',
      name: 'Trust Wallet',
      icon: 'com.trustwallet.app',
    },
    {
      id: 'com.binance.wallet',
      name: 'Binance Wallet',
      icon: 'com.binance.wallet',
    },
    { id: 'walletConnect', name: 'WalletConnect', icon: 'walletconnect' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      // presentationStyle="pageSheet"
       presentationStyle="fullScreen"
  statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView  edges={['top','left','right','bottom']}style={styles.container}>
        <LinearGradient
          colors={['#1A0048', '#5B2BD6', '#9F7BFF']}
          style={styles.gradientBackground}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Connect Wallet</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Choose your preferred wallet to connect to ABCDefi
          </Text>

          {/* Wallet Options */}
          <View style={styles.walletList}>
            {wallets.map(wallet => (
              <WalletOption
                key={wallet.id}
                walletId={wallet.id}
                walletName={wallet.name}
                walletIcon={wallet.icon}
                onPress={() => handleWalletPress(wallet.id, wallet.name)}
                isLoading={connectingWallet === wallet.id}
              />
            ))}
          </View>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Text style={styles.securityText}>
              🔒 Your connection is secure and encrypted
            </Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    // paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 30,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  walletList: {
    flex: 1,
    gap: 15,
  },
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  walletIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  walletIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  placeholderIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  walletName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
  },
  walletNote: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 2,
    fontFamily: Fonts.regular,
  },
  optionContainer: {
    marginBottom: 5,
  },
  loader: {
    marginLeft: 10,
  },
  securityNote: {
    marginTop: 30,
    marginBottom: 20,
    alignItems: 'center',
  },
  securityText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
});

export default WalletModal;
