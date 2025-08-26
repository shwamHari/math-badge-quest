import { createContext, useContext, useState } from 'react';
import { SecretNetworkClient } from 'secretjs';

interface WalletContextType {
  address: string | null;
  client: SecretNetworkClient | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [client, setClient] = useState<SecretNetworkClient | null>(null);

  const connectWallet = async () => {
    try {
      if (!window.keplr) {
        alert('Keplr wallet is not installed. Please install the Keplr browser extension.');
        return;
      }

      const chainId = import.meta.env.VITE_CHAIN_ID as string;
      const lcdUrl = import.meta.env.VITE_LCD_URL as string;

      await window.keplr.enable(chainId);
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();

      const client = new SecretNetworkClient({
        url: lcdUrl,
        chainId: chainId,
        wallet: offlineSigner,
        walletAddress: accounts[0].address,
      });

      setAddress(accounts[0].address);
      setClient(client);
    } catch (error) {
      console.error('Wallet connection error:', error);
      alert('Failed to connect wallet. Ensure Keplr is set up for Pulsar-3 testnet.');
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setClient(null);
  };

  return (
    <WalletContext.Provider value={{ address, client, connectWallet, disconnectWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}