import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, AlertTriangle, Wallet as WalletIcon, CheckCircle, ExternalLink, Copy, Loader2 } from 'lucide-react';
import { Wallet } from '../types/wallet';
import { fetchEncryptedBalance, createPrivateTransfer, getAddressInfo } from '../utils/api';
import { resolveAddressOrDomain } from '../utils/domainApi';
import { AddressInput } from './AddressInput';
import { useToast } from '@/hooks/use-toast';

interface PrivateTransferProps {
  wallet: Wallet | null;
  onTransactionSuccess: () => void;
}

export function PrivateTransfer({ wallet, onTransactionSuccess }: PrivateTransferProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [resolvedRecipientAddress, setResolvedRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  const [encryptedBalance, setEncryptedBalance] = useState<any>(null);
  const [recipientInfo, setRecipientInfo] = useState<any>(null);
  const [result, setResult] = useState<{ success: boolean; tx_hash?: string; ephemeral_key?: string; error?: string } | null>(null);
  const { toast } = useToast();

  // Fetch encrypted balance when wallet changes
  useEffect(() => {
    if (wallet) {
      fetchEncryptedBalance(wallet.address, wallet.privateKey).then(setEncryptedBalance);
    }
  }, [wallet]);

  // Check recipient when address changes
  useEffect(() => {
    const checkRecipient = async () => {
      const finalAddress = resolvedRecipientAddress || recipientAddress;
      if (!finalAddress || finalAddress.length < 10) {
        setRecipientInfo(null);
        return;
      }

      if (!finalAddress.startsWith('oct') || finalAddress.length < 40) {
        setRecipientInfo(null);
        return;
      }

      if (finalAddress === wallet?.address) {
        setRecipientInfo({ error: "Cannot send to yourself" });
        return;
      }

      setIsCheckingRecipient(true);
      try {
        const info = await getAddressInfo(finalAddress);
        setRecipientInfo(info);
      } catch (error) {
        setRecipientInfo({ error: "Failed to check recipient" });
      } finally {
        setIsCheckingRecipient(false);
      }
    };

    const timeoutId = setTimeout(checkRecipient, 500);
    return () => clearTimeout(timeoutId);
  }, [recipientAddress, resolvedRecipientAddress, wallet?.address]);

  const validateAddress = (address: string) => {
    const octAddressRegex = /^oct[1-9A-HJ-NP-Za-km-z]{44}$/;
    return octAddressRegex.test(address);
  };

  const validateAmount = (amountStr: string) => {
    const num = parseFloat(amountStr);
    return !isNaN(num) && num > 0;
  };

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

  const handleSend = async () => {
    if (!wallet) {
      toast({
        title: "Error",
        description: "No wallet connected",
        variant: "destructive",
      });
      return;
    }

    const finalRecipientAddress = resolvedRecipientAddress || recipientAddress;
    
    if (!validateAddress(finalRecipientAddress)) {
      toast({
        title: "Error",
        description: "Invalid recipient address",
        variant: "destructive",
      });
      return;
    }

    if (!validateAmount(amount)) {
      toast({
        title: "Error",
        description: "Invalid amount",
        variant: "destructive",
      });
      return;
    }

    if (!recipientInfo || recipientInfo.error) {
      toast({
        title: "Error",
        description: recipientInfo?.error || "Invalid recipient",
        variant: "destructive",
      });
      return;
    }

    if (!recipientInfo.has_public_key) {
      toast({
        title: "Error",
        description: "Recipient has no public key. They need to make a transaction first.",
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (!encryptedBalance || amountNum > encryptedBalance.encrypted) {
      toast({
        title: "Error",
        description: "Insufficient encrypted balance",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const transferResult = await createPrivateTransfer(
        wallet.address,
        finalRecipientAddress,
        amountNum,
        wallet.privateKey
      );

      setResult(transferResult);

      if (transferResult.success) {
        toast({
          title: "Private Transfer Sent!",
          description: "Private transfer has been submitted successfully",
        });

        // Reset form
        setRecipientAddress('');
        setResolvedRecipientAddress('');
        setAmount('');
        setRecipientInfo(null);

        // Refresh encrypted balance
        fetchEncryptedBalance(wallet.address, wallet.privateKey).then(setEncryptedBalance);

        onTransactionSuccess();
      } else {
        toast({
          title: "Transfer Failed",
          description: transferResult.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Private transfer error:', error);
      toast({
        title: "Error",
        description: "Failed to send private transfer",
        variant: "destructive",
      });
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsSending(false);
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

  if (!encryptedBalance || encryptedBalance.encrypted <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Private Transfer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <AlertDescription>
                No encrypted balance available. You need to encrypt some balance first to make private transfers.
              </AlertDescription>
            </div>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Private Transfer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <div className="flex items-start space-x-3">
            <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <AlertDescription>
              Private transfers use your encrypted balance and are completely anonymous. The recipient can claim the transfer in the next epoch.
            </AlertDescription>
          </div>
        </Alert>

        {/* Encrypted Balance Display */}
        <div className="p-3 bg-muted rounded-md">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Available Private Balance</span>
            <span className="font-mono text-lg font-bold text-yellow-600">
              {encryptedBalance.encrypted.toFixed(8)} OCT
            </span>
          </div>
        </div>

        {/* Recipient Address */}
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Address</Label>
          <AddressInput
            value={recipientAddress}
            onChange={setRecipientAddress}
            onResolvedAddress={setResolvedRecipientAddress}
            placeholder="oct... or domain.oct"
          />
          
          {/* Recipient Status */}
          {isCheckingRecipient && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking recipient...
            </div>
          )}
          
          {recipientInfo && !isCheckingRecipient && (
            <div className="space-y-2">
              {recipientInfo.error ? (
                <div className="text-sm text-red-600">{recipientInfo.error}</div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Valid recipient</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Balance: {recipientInfo.balance || '0'} OCT
                  </div>
                  {!recipientInfo.has_public_key && (
                    <div className="text-sm text-red-600">
                      ⚠️ Recipient has no public key. They need to make a transaction first.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (OCT)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="0.00000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.00000001"
            min="0"
            max={encryptedBalance.encrypted}
          />
          {amount && validateAmount(amount) && parseFloat(amount) > encryptedBalance.encrypted && (
            <p className="text-sm text-red-600">Amount exceeds available encrypted balance</p>
          )}
        </div>

        {/* Transaction Result */}
        {result && (
          <div className={`rounded-lg p-4 ${result.success ? 'bg-green-50 border border-green-200 dark:bg-green-950/50 dark:border-green-800' : 'bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-800'}`}>
            <div className="flex items-start space-x-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  {result.success ? 'Private Transfer Sent Successfully!' : 'Private Transfer Failed'}
                </p>
                {result.success && result.tx_hash && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-green-700 dark:text-green-300 text-sm">Transaction Hash:</p>
                      <div className="flex flex-col sm:flex-row sm:items-center mt-1 space-y-1 sm:space-y-0 sm:space-x-2">
                        <code className="text-xs bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded font-mono break-all text-green-800 dark:text-green-200 flex-1">
                          {result.tx_hash}
                        </code>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(result.tx_hash!, 'Transaction Hash')}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <a
                            href={`https://octrascan.io/tx/${result.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-6 w-6 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="View on OctraScan"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                    {result.ephemeral_key && (
                      <div>
                        <p className="text-green-700 dark:text-green-300 text-sm">Ephemeral Key:</p>
                        <div className="flex flex-col sm:flex-row sm:items-center mt-1 space-y-1 sm:space-y-0 sm:space-x-2">
                          <code className="text-xs bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded font-mono break-all text-green-800 dark:text-green-200 flex-1">
                            {result.ephemeral_key}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(result.ephemeral_key!, 'Ephemeral Key')}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-green-700 dark:text-green-300 text-sm">
                      Recipient can claim in next epoch
                    </p>
                  </div>
                )}
                {result.error && (
                  <p className="text-red-700 dark:text-red-300 text-sm mt-1 break-words">{result.error}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <Button 
          onClick={handleSend}
          disabled={
            isSending || 
            !validateAddress(resolvedRecipientAddress || recipientAddress) || 
            !validateAmount(amount) || 
            !recipientInfo ||
            recipientInfo.error ||
            !recipientInfo.has_public_key ||
            parseFloat(amount) > encryptedBalance.encrypted
          }
          className="w-full"
          size="lg"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending Private Transfer...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Send Private Transfer
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}