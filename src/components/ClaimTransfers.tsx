import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Gift, RefreshCw, Wallet as WalletIcon, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Wallet } from '../types/wallet';
import { getPendingPrivateTransfers, claimPrivateTransfer, fetchEncryptedBalance } from '../utils/api';
import { deriveSharedSecretForClaim, decryptPrivateAmount } from '../utils/crypto';
import { useToast } from '@/hooks/use-toast';

interface ClaimTransfersProps {
  wallet: Wallet | null;
  onTransactionSuccess: () => void;
}

export function ClaimTransfers({ wallet, onTransactionSuccess }: ClaimTransfersProps) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTransfers = async () => {
    if (!wallet) return;
    
    setIsLoading(true);
    try {
      const pendingTransfers = await getPendingPrivateTransfers(wallet.address, wallet.privateKey);
      
      // Decrypt amounts for display
      const transfersWithAmounts = await Promise.all(
        pendingTransfers.map(async (transfer) => {
          let decryptedAmount = null;
          
          if (transfer.encrypted_data && transfer.ephemeral_key) {
            try {
              const sharedSecret = await deriveSharedSecretForClaim(wallet.privateKey, transfer.ephemeral_key);
              const amount = await decryptPrivateAmount(transfer.encrypted_data, sharedSecret);
              if (amount !== null) {
                decryptedAmount = amount / 1_000_000; // Convert from micro units
              }
            } catch (error) {
              console.error('Failed to decrypt amount for transfer:', transfer.id, error);
            }
          }
          
          return {
            ...transfer,
            decryptedAmount
          };
        })
      );
      
      setTransfers(transfersWithAmounts);
      
      if (transfersWithAmounts.length > 0) {
        toast({
          title: "Transfers Loaded",
          description: `Found ${transfersWithAmounts.length} claimable transfers`,
        });
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch pending transfers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (wallet) {
      fetchTransfers();
    }
  }, [wallet]);

  const handleClaim = async (transferId: string) => {
    if (!wallet) return;
    
    setClaimingId(transferId);
    
    try {
      const result = await claimPrivateTransfer(wallet.address, wallet.privateKey, transferId);
      
      if (result.success) {
        toast({
          title: "Transfer Claimed!",
          description: `Successfully claimed ${result.amount || 'transfer'}`,
        });
        
        // Refresh transfers list
        await fetchTransfers();
        
        // Notify parent component
        onTransactionSuccess();
      } else {
        toast({
          title: "Claim Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Claim error:', error);
      toast({
        title: "Error",
        description: "Failed to claim transfer",
        variant: "destructive",
      });
    } finally {
      setClaimingId(null);
    }
  };

  if (!wallet) {
    return (
      <Alert>
        <WalletIcon className="h-4 w-4" />
        <AlertDescription>
          No wallet available. Please generate or import a wallet first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Claim Private Transfers
          {transfers.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {transfers.length}
            </Badge>
          )}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTransfers}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Loading pending transfers...</div>
            {[...Array(2)].map((_, i) => (
              <div key={i} className="space-y-2 p-4 border rounded-lg">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : transfers.length === 0 ? (
          <Alert>
            <div className="flex items-start space-x-3">
              <Gift className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <AlertDescription>
                No pending private transfers found. When someone sends you a private transfer, it will appear here for claiming.
              </AlertDescription>
            </div>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Found {transfers.length} claimable transfer{transfers.length !== 1 ? 's' : ''}
            </div>
            
            {transfers.map((transfer, index) => (
              <div key={transfer.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Transfer #{transfer.id}</span>
                      <Badge variant="outline" className="text-xs">
                        Epoch {transfer.epoch_id}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      From: {transfer.sender.slice(0, 12)}...{transfer.sender.slice(-8)}
                    </div>
                  </div>
                  
                  <div className="text-right space-y-1">
                    <div className="font-mono font-bold text-green-600">
                      {transfer.decryptedAmount !== null 
                        ? `${transfer.decryptedAmount.toFixed(8)} OCT`
                        : '[Encrypted]'
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(transfer.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={() => handleClaim(transfer.id)}
                    disabled={claimingId === transfer.id}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {claimingId === transfer.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      <>
                        <Gift className="h-4 w-4" />
                        Claim Transfer
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}