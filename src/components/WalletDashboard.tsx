import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wallet as WalletIcon, 
  Send, 
  History, 
  LogOut,
  Copy,
  PieChart,
  Shield,
  Gift,
  ChevronDown,
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import { Balance } from './Balance';
import { MultiSend } from './MultiSend';
import { SendTransaction } from './SendTransaction';
import { PrivateTransfer } from './PrivateTransfer';
import { ClaimTransfers } from './ClaimTransfers';
import { TxHistory } from './TxHistory';
import { ThemeToggle } from './ThemeToggle';
import { ImportWallet } from './ImportWallet';
import { Wallet } from '../types/wallet';
import { fetchBalance, getTransactionHistory } from '../utils/api';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  type: 'sent' | 'received';
}

interface WalletDashboardProps {
  wallet: Wallet;
  wallets: Wallet[];
  onDisconnect: () => void;
  onSwitchWallet: (wallet: Wallet) => void;
  onAddWallet: (wallet: Wallet) => void;
  onRemoveWallet: (wallet: Wallet) => void;
}

export function WalletDashboard({ 
  wallet, 
  wallets, 
  onDisconnect, 
  onSwitchWallet, 
  onAddWallet, 
  onRemoveWallet 
}: WalletDashboardProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { toast } = useToast();

  // Initial data fetch when wallet is connected
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!wallet) return;

      try {
        // Fetch balance and nonce
        setIsLoadingBalance(true);
        const balanceData = await fetchBalance(wallet.address);
        setBalance(balanceData.balance);
        setNonce(balanceData.nonce);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        toast({
          title: "Error",
          description: "Balance fetch failed",
          variant: "destructive",
        });
      } finally {
        setIsLoadingBalance(false);
      }

      try {
        // Fetch transaction history
        setIsLoadingTransactions(true);
        const historyData = await getTransactionHistory(wallet.address);
        
        if (Array.isArray(historyData)) {
          const transformedTxs = historyData.map((tx) => ({
            ...tx,
            type: tx.from?.toLowerCase() === wallet.address.toLowerCase() ? 'sent' : 'received'
          } as Transaction));
          setTransactions(transformedTxs);
        }
      } catch (error) {
        console.error('Failed to fetch transaction history:', error);
        toast({
          title: "Error",
          description: "History fetch failed",
          variant: "destructive",
        });
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    fetchInitialData();
  }, [wallet, toast]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Copy failed",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Are you sure you want to disconnect all wallets? Make sure you have backed up your private keys or mnemonic phrases.')) {
      onDisconnect();
    }
  };

  const handleRemoveWallet = (walletToRemove: Wallet) => {
    if (wallets.length === 1) {
      toast({
        title: "Cannot Remove",
        description: "You cannot remove the last wallet. Use disconnect instead.",
        variant: "destructive",
      });
      return;
    }
    
    if (window.confirm(`Are you sure you want to remove wallet ${truncateAddress(walletToRemove.address)}?`)) {
      onRemoveWallet(walletToRemove);
      toast({
        title: "Wallet Removed",
        description: "Wallet has been removed successfully",
      });
    }
  };

  const handleImportSuccess = (newWallet: Wallet) => {
    onAddWallet(newWallet);
    setShowImportDialog(false);
    toast({
      title: "Wallet Added",
      description: "New wallet has been added successfully",
    });
  };
  const handleBalanceUpdate = async (newBalance: number) => {
    setBalance(newBalance);
    // Also refresh nonce when balance is updated
    try {
      const balanceData = await fetchBalance(wallet.address);
      setNonce(balanceData.nonce);
    } catch (error) {
      console.error('Failed to refresh nonce:', error);
    }
  };

  const handleNonceUpdate = (newNonce: number) => {
    setNonce(newNonce);
  };

  const handleTransactionsUpdate = (newTransactions: Transaction[]) => {
    setTransactions(newTransactions);
  };

  const handleTransactionSuccess = async () => {
    // Refresh transaction history and balance after successful transaction
    const refreshData = async () => {
      try {
        // Refresh balance and nonce
        const balanceData = await fetchBalance(wallet.address);
        setBalance(balanceData.balance);
        setNonce(balanceData.nonce);

        // Refresh transaction history
        const historyData = await getTransactionHistory(wallet.address);
        
        if (Array.isArray(historyData)) {
          const transformedTxs = historyData.map((tx) => ({
            ...tx,
            type: tx.from?.toLowerCase() === wallet.address.toLowerCase() ? 'sent' : 'received'
          } as Transaction));
          setTransactions(transformedTxs);
        }
      } catch (error) {
        console.error('Failed to refresh data after transaction:', error);
      }
    };

    // Small delay to allow transaction to propagate
    setTimeout(refreshData, 2000);
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <WalletIcon className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-bold">Octra Wallet</h1>
                  <div className="flex items-center space-x-2">
                    {/* Wallet Selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm text-muted-foreground">
                              {truncateAddress(wallet.address)}
                            </p>
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-80 max-h-[70vh] p-0">
                        <div className="px-2 py-1.5 text-sm font-medium">
                          Select Wallet ({wallets.length})
                        </div>
                        <DropdownMenuSeparator />
                        <div className="max-h-[50vh] overflow-y-auto p-1">
                          {wallets.map((w, i) => (
                            <div
                              key={w.address}
                              className="flex items-center justify-between p-3 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer group"
                              onClick={() => onSwitchWallet(w)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-sm truncate">
                                  #{i + 1} {truncateAddress(w.address)}
                                  </span>
                                  {w.address === wallet.address && (
                                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  )}
                                </div>
                                {w.mnemonic && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Generated wallet
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(w.address, 'Address');
                                  }}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  title="Copy address"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                {wallets.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveWallet(w);
                                    }}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                    title="Remove wallet"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <DropdownMenuSeparator />
                        <div
                          onClick={() => setShowImportDialog(true)}
                          className="flex items-center justify-center space-x-2 p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm mx-1 mb-1"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Wallet</span>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(wallet.address, 'Address')}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  Connected
                </Badge>
                <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                  Nonce: {nonce}
                </Badge>
                <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                  {wallets.length} Wallet{wallets.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Wallet</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Import Additional Wallet</DialogTitle>
                  </DialogHeader>
                  <ImportWallet onWalletImported={handleImportSuccess} />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Disconnect All</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </TabsTrigger>
            <TabsTrigger value="private" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Private</span>
            </TabsTrigger>
            <TabsTrigger value="claim" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Claim</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Balance 
              wallet={wallet} 
              balance={balance}
              onBalanceUpdate={handleBalanceUpdate}
              isLoading={isLoadingBalance}
            />
          </TabsContent>

          <TabsContent value="send">
            <div className="space-y-6">
              <SendTransaction
                wallet={wallet} 
                balance={balance}
                nonce={nonce}
                onBalanceUpdate={handleBalanceUpdate}
                onNonceUpdate={handleNonceUpdate}
                onTransactionSuccess={handleTransactionSuccess}
              />
              <MultiSend 
                wallet={wallet} 
                balance={balance}
                nonce={nonce}
                onBalanceUpdate={handleBalanceUpdate}
                onNonceUpdate={handleNonceUpdate}
                onTransactionSuccess={handleTransactionSuccess}
              />
            </div>
          </TabsContent>

          <TabsContent value="private">
            <PrivateTransfer
              wallet={wallet}
              onTransactionSuccess={handleTransactionSuccess}
            />
          </TabsContent>

          <TabsContent value="claim">
            <ClaimTransfers
              wallet={wallet}
              onTransactionSuccess={handleTransactionSuccess}
            />
          </TabsContent>

          <TabsContent value="history">
            <TxHistory 
              wallet={wallet} 
              transactions={transactions}
              onTransactionsUpdate={handleTransactionsUpdate}
              isLoading={isLoadingTransactions}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}