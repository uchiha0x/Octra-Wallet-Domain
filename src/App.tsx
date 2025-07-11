import React, { useState, useEffect } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { WalletDashboard } from './components/WalletDashboard';
import { ThemeProvider } from './components/ThemeProvider';
import { Wallet } from './types/wallet';
import { Toaster } from '@/components/ui/toaster';

function App() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    const storedWallets = localStorage.getItem('wallets');
    const activeWalletId = localStorage.getItem('activeWalletId');
    if (storedWallets) {
      const parsedWallets = JSON.parse(storedWallets);
      setWallets(parsedWallets);
      
      // Set active wallet based on stored ID or default to first wallet
      if (parsedWallets.length > 0) {
        let activeWallet = parsedWallets[0];
        if (activeWalletId) {
          const foundWallet = parsedWallets.find((w: Wallet) => w.address === activeWalletId);
          if (foundWallet) {
            activeWallet = foundWallet;
          }
        }
        setWallet(activeWallet);
      }
    }
  }, []);

  const addWallet = (newWallet: Wallet) => {
    // Check if wallet already exists
    const existingWallet = wallets.find(w => w.address === newWallet.address);
    if (existingWallet) {
      // If wallet exists, just switch to it
      setWallet(existingWallet);
      localStorage.setItem('activeWalletId', existingWallet.address);
      return;
    }
    
    const updatedWallets = [...wallets, newWallet];
    setWallets(updatedWallets);
    setWallet(newWallet);
    localStorage.setItem('wallets', JSON.stringify(updatedWallets));
    localStorage.setItem('activeWalletId', newWallet.address);
  };

  const switchWallet = (selectedWallet: Wallet) => {
    setWallet(selectedWallet);
    localStorage.setItem('activeWalletId', selectedWallet.address);
  };

  const removeWallet = (walletToRemove: Wallet) => {
    const updatedWallets = wallets.filter(w => w.address !== walletToRemove.address);
    setWallets(updatedWallets);
    localStorage.setItem('wallets', JSON.stringify(updatedWallets));
    
    // If removing active wallet, switch to another or clear
    if (wallet?.address === walletToRemove.address) {
      if (updatedWallets.length > 0) {
        const newActiveWallet = updatedWallets[0];
        setWallet(newActiveWallet);
        localStorage.setItem('activeWalletId', newActiveWallet.address);
      } else {
        setWallet(null);
        localStorage.removeItem('activeWalletId');
      }
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    setWallets([]);
    localStorage.removeItem('wallets');
    localStorage.removeItem('activeWalletId');
    
    // Reset theme to light when disconnecting
    localStorage.setItem('octra-wallet-theme', 'light');
    // Force theme reset by dispatching storage event
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'octra-wallet-theme',
      newValue: 'light'
    }));
  };

  return (
    <ThemeProvider defaultTheme="light" storageKey="octra-wallet-theme">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        {!wallet ? (
          <WelcomeScreen onWalletCreated={addWallet} />
        ) : (
          <WalletDashboard 
            wallet={wallet} 
            wallets={wallets}
            onDisconnect={disconnectWallet}
            onSwitchWallet={switchWallet}
            onAddWallet={addWallet}
            onRemoveWallet={removeWallet}
          />
        )}
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default App;