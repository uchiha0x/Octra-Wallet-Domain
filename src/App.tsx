import React, { useState, useEffect } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { WalletDashboard } from './components/WalletDashboard';
import { UnlockWallet } from './components/UnlockWallet';
import { DAppConnection } from './components/DAppConnection';
import { ThemeProvider } from './components/ThemeProvider';
import { Wallet, DAppConnectionRequest } from './types/wallet';
import { Toaster } from '@/components/ui/toaster';

function App() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [connectionRequest, setConnectionRequest] = useState<DAppConnectionRequest | null>(null);
  const [selectedWalletForConnection, setSelectedWalletForConnection] = useState<Wallet | null>(null);

  useEffect(() => {
    // Check if wallet is locked
    const walletLocked = localStorage.getItem('isWalletLocked');
    const hasPassword = localStorage.getItem('walletPasswordHash');
    
    if (hasPassword && walletLocked !== 'false') {
      setIsLocked(true);
      return;
    }

    // Check for dApp connection request in URL
    const urlParams = new URLSearchParams(window.location.search);
    const successUrl = urlParams.get('success_url');
    const failureUrl = urlParams.get('failure_url');
    const origin = urlParams.get('origin');
    const appName = urlParams.get('app_name');
    
    if (successUrl && failureUrl && origin) {
      setConnectionRequest({
        origin: decodeURIComponent(origin),
        successUrl: decodeURIComponent(successUrl),
        failureUrl: decodeURIComponent(failureUrl),
        permissions: ['view_address', 'view_balance', 'call_methods'],
        appName: appName ? decodeURIComponent(appName) : undefined
      });
    }

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

  const handleUnlock = (unlockedWallets: Wallet[]) => {
    setWallets(unlockedWallets);
    setIsLocked(false);
    
    // Set active wallet
    if (unlockedWallets.length > 0) {
      const activeWalletId = localStorage.getItem('activeWalletId');
      let activeWallet = unlockedWallets[0];
      if (activeWalletId) {
        const foundWallet = unlockedWallets.find(w => w.address === activeWalletId);
        if (foundWallet) {
          activeWallet = foundWallet;
        }
      }
      setWallet(activeWallet);
    }
  };

  const handleConnectionApprove = (selectedWallet: Wallet) => {
    if (!connectionRequest) return;
    
    // Store connection
    const connections = JSON.parse(localStorage.getItem('connectedDApps') || '[]');
    const newConnection = {
      origin: connectionRequest.origin,
      appName: connectionRequest.appName || connectionRequest.origin,
      connectedAt: Date.now(),
      permissions: connectionRequest.permissions,
      selectedAddress: selectedWallet.address
    };
    connections.push(newConnection);
    localStorage.setItem('connectedDApps', JSON.stringify(connections));
    
    // Redirect to success URL with wallet info
    const successUrl = new URL(connectionRequest.successUrl);
    successUrl.searchParams.set('account_id', selectedWallet.address);
    successUrl.searchParams.set('public_key', selectedWallet.publicKey || '');
    
    window.location.href = successUrl.toString();
  };

  const handleConnectionReject = () => {
    if (!connectionRequest) return;
    
    // Redirect to failure URL
    window.location.href = connectionRequest.failureUrl;
  };

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
    localStorage.setItem('octra-wallet-theme', 'dark');
    // Force theme reset by dispatching storage event
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'octra-wallet-theme',
      newValue: 'dark'
    }));
    
    // Lock wallet
    localStorage.setItem('isWalletLocked', 'true');
    setIsLocked(true);
  };

  // Show unlock screen if wallet is locked
  if (isLocked) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="octra-wallet-theme">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <UnlockWallet onUnlock={handleUnlock} />
          <Toaster />
        </div>
      </ThemeProvider>
    );
  }

  // Show dApp connection screen if there's a connection request
  if (connectionRequest && wallets.length > 0) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="octra-wallet-theme">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <DAppConnection
            connectionRequest={connectionRequest}
            wallets={wallets}
            selectedWallet={selectedWalletForConnection}
            onWalletSelect={setSelectedWalletForConnection}
            onApprove={handleConnectionApprove}
            onReject={handleConnectionReject}
          />
          <Toaster />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="octra-wallet-theme">
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