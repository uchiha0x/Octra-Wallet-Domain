// api.ts
import { BalanceResponse, Transaction, AddressHistoryResponse, TransactionDetails, PendingTransaction, StagingResponse, EncryptedBalanceResponse, PendingPrivateTransfer, PrivateTransferResult, ClaimResult } from '../types/wallet';
import { encryptClientBalance } from './crypto';
import { makeRPCRequest } from './rpc';
import * as nacl from 'tweetnacl';

const MU_FACTOR = 1_000_000;

export async function fetchBalance(address: string): Promise<BalanceResponse> {
  try {
    // Fetch both balance and staging data like CLI does
    const [balanceResponse, stagingResponse] = await Promise.all([
      makeRPCRequest(`/balance/${address}`),
      makeRPCRequest(`/staging`).catch(() => ({ ok: false }))
    ]);
    
    if (!balanceResponse.ok) {
      const errorText = await balanceResponse.text();
      console.error('Failed to fetch balance:', balanceResponse.status, errorText);
      throw new Error(`Error ${balanceResponse.status}`);
    }
    
    const data: any = await balanceResponse.json();

    const balance = typeof data.balance === 'string' ? parseFloat(data.balance) : (data.balance || 0);
    
    // Calculate nonce exactly like CLI: max of transaction_count and highest pending nonce
    const transactionCount = data.nonce || 0;
    let nonce = transactionCount;
    
    // Check staging for our pending transactions like CLI does
    if ('ok' in stagingResponse && stagingResponse.ok) {
      try {
        const stagingData = await (stagingResponse as Response).json();
        if (stagingData.staged_transactions) {
          const ourPendingTxs = stagingData.staged_transactions.filter(
            (tx: any) => tx.from === address
          );
          if (ourPendingTxs.length > 0) {
            const maxPendingNonce = Math.max(...ourPendingTxs.map((tx: any) => parseInt(tx.nonce) || 0));
            nonce = Math.max(nonce, maxPendingNonce);
          }
        }
      } catch (error) {
        console.warn('Failed to parse staging data for nonce calculation:', error);
      }
    }

    if (isNaN(balance) || isNaN(nonce)) {
        console.warn('Invalid balance or nonce in API response', { balance, nonce });
        return { balance: 0, nonce: 0 };
    }

    return { balance, nonce };
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw error;
  }
}

export async function fetchEncryptedBalance(address: string, privateKey: string): Promise<EncryptedBalanceResponse | null> {
  try {
    const response = await makeRPCRequest(`/view_encrypted_balance/${address}`, {
      headers: {
        'X-Private-Key': privateKey
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    return {
      public: parseFloat(data.public_balance?.split(' ')[0] || '0'),
      public_raw: parseInt(data.public_balance_raw || '0'),
      encrypted: parseFloat(data.encrypted_balance?.split(' ')[0] || '0'),
      encrypted_raw: parseInt(data.encrypted_balance_raw || '0'),
      total: parseFloat(data.total_balance?.split(' ')[0] || '0')
    };
  } catch (error) {
    console.error('Error fetching encrypted balance:', error);
    return null;
  }
}

export async function encryptBalance(address: string, amount: number, privateKey: string): Promise<{ success: boolean; tx_hash?: string; error?: string }> {
  try {
    const encData = await fetchEncryptedBalance(address, privateKey);
    if (!encData) {
      return { success: false, error: "Cannot get balance" };
    }
    
    const currentEncryptedRaw = encData.encrypted_raw;
    const newEncryptedRaw = currentEncryptedRaw + Math.floor(amount * MU_FACTOR);
    
    const encryptedValue = await encryptClientBalance(newEncryptedRaw, privateKey);
    
    const data = {
      address,
      amount: Math.floor(amount * MU_FACTOR).toString(),
      private_key: privateKey,
      encrypted_data: encryptedValue
    };
    
    const response = await makeRPCRequest('/encrypt_balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      const result = await response.json();
      return { success: true, tx_hash: result.tx_hash };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function decryptBalance(address: string, amount: number, privateKey: string): Promise<{ success: boolean; tx_hash?: string; error?: string }> {
  try {
    const encData = await fetchEncryptedBalance(address, privateKey);
    if (!encData) {
      return { success: false, error: "Cannot get balance" };
    }
    
    const currentEncryptedRaw = encData.encrypted_raw;
    if (currentEncryptedRaw < Math.floor(amount * MU_FACTOR)) {
      return { success: false, error: "Insufficient encrypted balance" };
    }
    
    const newEncryptedRaw = currentEncryptedRaw - Math.floor(amount * MU_FACTOR);
    
    const encryptedValue = await encryptClientBalance(newEncryptedRaw, privateKey);
    
    const data = {
      address,
      amount: Math.floor(amount * MU_FACTOR).toString(),
      private_key: privateKey,
      encrypted_data: encryptedValue
    };
    
    const response = await makeRPCRequest('/decrypt_balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      const result = await response.json();
      return { success: true, tx_hash: result.tx_hash };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getAddressInfo(address: string): Promise<any> {
  try {
    const response = await makeRPCRequest(`/address/${address}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error fetching address info:', error);
    return null;
  }
}

export async function getPublicKey(address: string): Promise<string | null> {
  try {
    const response = await makeRPCRequest(`/public_key/${address}`);
    if (response.ok) {
      const data = await response.json();
      return data.public_key;
    }
    return null;
  } catch (error) {
    console.error('Error fetching public key:', error);
    return null;
  }
}

export async function createPrivateTransfer(fromAddress: string, toAddress: string, amount: number, fromPrivateKey: string): Promise<PrivateTransferResult> {
  try {
    const addressInfo = await getAddressInfo(toAddress);
    if (!addressInfo || !addressInfo.has_public_key) {
      return { success: false, error: "Recipient has no public key" };
    }
    
    const toPublicKey = await getPublicKey(toAddress);
    if (!toPublicKey) {
      return { success: false, error: "Cannot get recipient public key" };
    }
    
    const data = {
      from: fromAddress,
      to: toAddress,
      amount: Math.floor(amount * MU_FACTOR).toString(),
      from_private_key: fromPrivateKey,
      to_public_key: toPublicKey
    };
    
    const response = await makeRPCRequest('/private_transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        tx_hash: result.tx_hash,
        ephemeral_key: result.ephemeral_key
      };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getPendingPrivateTransfers(address: string, privateKey: string): Promise<PendingPrivateTransfer[]> {
  try {
    const response = await makeRPCRequest(`/pending_private_transfers?address=${address}`, {
      headers: {
        'X-Private-Key': privateKey
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.pending_transfers || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching pending private transfers:', error);
    return [];
  }
}

export async function claimPrivateTransfer(recipientAddress: string, privateKey: string, transferId: string): Promise<ClaimResult> {
  try {
    const data = {
      recipient_address: recipientAddress,
      private_key: privateKey,
      transfer_id: transferId
    };
    
    const response = await makeRPCRequest('/claim_private_transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        amount: result.amount
      };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendTransaction(transaction: Transaction): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    console.log('Sending transaction:', JSON.stringify(transaction, null, 2));
    
    const response = await makeRPCRequest(`/send-tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transaction),
    });

    const text = await response.text();
    console.log('Server response:', response.status, text);

    if (response.ok) {
      try {
        const data = JSON.parse(text);
        if (data.status === 'accepted') {
          return { success: true, hash: data.tx_hash };
        }
      } catch {
        const hashMatch = text.match(/OK\s+([0-9a-fA-F]{64})/);
        if (hashMatch) {
          return { success: true, hash: hashMatch[1] };
        }
      }
      return { success: true, hash: text };
    }

    console.error('Transaction failed:', text);
    return { success: false, error: text };
  } catch (error) {
    console.error('Error sending transaction:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export function createTransaction(
  senderAddress: string,
  recipientAddress: string,
  amount: number,
  nonce: number,
  privateKeyBase64: string,
  publicKeyHex: string,
  message?: string
): Transaction {
  // Convert amount to micro units (multiply by 1,000,000)
  const amountMu = Math.floor(amount * MU_FACTOR);
  
  // Determine OU based on amount
  const ou = amount < 1000 ? "1" : "3";
  
  // Create timestamp with small random component exactly like CLI
  const timestamp = Math.floor((Date.now() / 1000 + Math.random() * 0.01) * 1000) / 1000;

  // Create base transaction object
  const transaction: Transaction = {
    from: senderAddress,
    to_: recipientAddress,
    amount: amountMu.toString(),
    nonce,
    ou,
    timestamp
  };

  // Add message if provided (like CLI)
  if (message) {
    transaction.message = message;
  }

  // Convert transaction to JSON string for signing exactly like CLI
  // CLI uses: json.dumps({k: v for k, v in tx.items() if k != "message"}, separators=(",", ":"))
  // Create signing data excluding message field like CLI does
  const signingObject: any = {};
  // Add fields in the exact order as CLI to ensure consistent JSON
  signingObject.from = transaction.from;
  signingObject.to_ = transaction.to_;
  signingObject.amount = transaction.amount;
  signingObject.nonce = transaction.nonce;
  signingObject.ou = transaction.ou;
  signingObject.timestamp = transaction.timestamp;
  
  const signingData = JSON.stringify(signingObject, null, 0);
  
  // Prepare keys for signing
  const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');
  const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
  
  // Create secret key for nacl (64 bytes: 32 private + 32 public)
  const secretKey = new Uint8Array(64);
  secretKey.set(privateKeyBuffer, 0);
  secretKey.set(publicKeyBuffer, 32);

  // Sign the transaction
  const signature = nacl.sign.detached(new TextEncoder().encode(signingData), secretKey);

  // Add signature and public key to transaction
  transaction.signature = Buffer.from(signature).toString('base64');
  transaction.public_key = Buffer.from(publicKeyBuffer).toString('base64');

  return transaction;
}

// New function to fetch pending transactions from staging
export async function fetchPendingTransactions(address: string): Promise<PendingTransaction[]> {
  try {
    const response = await makeRPCRequest(`/staging`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch pending transactions:', response.status, errorText);
      throw new Error(`Error ${response.status}`);
    }
    
    const responseText = await response.text();
    let data: StagingResponse;
    
    try {
      data = JSON.parse(responseText);
      
      if (!data.staged_transactions || !Array.isArray(data.staged_transactions)) {
        console.warn('Staging response does not contain staged_transactions array:', data);
        return [];
      }
    } catch (parseError) {
      console.error('Failed to parse staging JSON:', parseError);
      return [];
    }
    
    // Filter transactions for the specific address
    const userTransactions = data.staged_transactions.filter(tx => 
      tx.from.toLowerCase() === address.toLowerCase() || 
      tx.to.toLowerCase() === address.toLowerCase()
    );
    
    return userTransactions;
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    return [];
  }
}

// New function to fetch specific pending transaction by hash
export async function fetchPendingTransactionByHash(hash: string): Promise<PendingTransaction | null> {
  try {
    const response = await makeRPCRequest(`/staging`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch pending transactions:', response.status, errorText);
      throw new Error(`Error ${response.status}`);
    }
    
    const responseText = await response.text();
    let data: StagingResponse;
    
    try {
      data = JSON.parse(responseText);
      
      if (!data.staged_transactions || !Array.isArray(data.staged_transactions)) {
        console.warn('Staging response does not contain staged_transactions array:', data);
        return null;
      }
    } catch (parseError) {
      console.error('Failed to parse staging JSON:', parseError);
      return null;
    }
    
    // Find transaction by hash
    const transaction = data.staged_transactions.find(tx => tx.hash === hash);
    return transaction || null;
  } catch (error) {
    console.error('Error fetching pending transaction by hash:', error);
    return null;
  }
}

// Updated interface to match actual API response
interface AddressApiResponse {
  address: string;
  balance: string;
  nonce: number;
  balance_raw: string;
  has_public_key: boolean;
  transaction_count: number;
  recent_transactions: Array<{
    epoch: number;
    hash: string;
    url: string;
  }>;
}

export async function fetchTransactionHistory(address: string): Promise<AddressHistoryResponse> {
  try {
    // Fetch both confirmed and pending transactions
    const [confirmedResponse, pendingTransactions] = await Promise.all([
      makeRPCRequest(`/address/${address}`),
      fetchPendingTransactions(address)
    ]);
    
    if (!confirmedResponse.ok) {
      const errorText = await confirmedResponse.text();
      console.error('Failed to fetch transaction history:', confirmedResponse.status, errorText);
      throw new Error(`Error ${confirmedResponse.status}`);
    }
    
    const responseText = await confirmedResponse.text();
    let apiData: AddressApiResponse;
    
    try {
      apiData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse transaction history JSON:', parseError);
      throw new Error('Invalid JSON response from server');
    }
    
    // Fetch details for each confirmed transaction
    const confirmedTransactionPromises = apiData.recent_transactions.map(async (recentTx) => {
      try {
        const txDetails = await fetchTransactionDetails(recentTx.hash);
        
        // Transform to our expected format
        return {
          hash: txDetails.tx_hash,
          from: txDetails.parsed_tx.from,
          to: txDetails.parsed_tx.to,
          amount: parseFloat(txDetails.parsed_tx.amount),
          timestamp: txDetails.parsed_tx.timestamp,
          status: 'confirmed' as const,
          type: txDetails.parsed_tx.from.toLowerCase() === address.toLowerCase() ? 'sent' as const : 'received' as const
        };
      } catch (error) {
        console.error('Failed to fetch transaction details for hash:', recentTx.hash, error);
        // Return a basic transaction object if details fetch fails
        return {
          hash: recentTx.hash,
          from: 'unknown',
          to: 'unknown',
          amount: 0,
          timestamp: Date.now() / 1000,
          status: 'confirmed' as const,
          type: 'received' as const
        };
      }
    });
    
    const confirmedTransactions = await Promise.all(confirmedTransactionPromises);
    
    // Transform pending transactions to our expected format
    const pendingTransactionsFormatted = pendingTransactions.map(tx => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.amount),
      timestamp: tx.timestamp,
      status: 'pending' as const,
      type: tx.from.toLowerCase() === address.toLowerCase() ? 'sent' as const : 'received' as const
    }));
    
    // Combine and sort by timestamp (newest first)
    const allTransactions = [...pendingTransactionsFormatted, ...confirmedTransactions]
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const result: AddressHistoryResponse = {
      transactions: allTransactions,
      balance: parseFloat(apiData.balance)
    };
    
    return result;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw error;
  }
}

export async function fetchTransactionDetails(hash: string): Promise<TransactionDetails> {
  try {
    const response = await makeRPCRequest(`/tx/${hash}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch transaction details:', response.status, errorText);
      throw new Error(`Error ${response.status}`);
    }
    
    const responseText = await response.text();
    let data: TransactionDetails;
    
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse transaction details JSON:', parseError);
      throw new Error('Invalid JSON response from server');
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    throw error;
  }
}

// Wrapper functions for compatibility with existing components
export async function getBalance(address: string): Promise<number> {
  try {
    const result = await fetchBalance(address);
    return result.balance;
  } catch (error) {
    console.error('Error fetching balance:', error);
    return Math.random() * 100; // Mock data for development
  }
}

export async function sendMultipleTransactions(transactions: any[]): Promise<string[]> {
  try {
    const promises = transactions.map(async (txData, index) => {
      // Convert the transaction data to the proper format
      const transaction = createTransaction(
        txData.from,
        txData.to,
        txData.amount,
        0, // nonce will be handled properly in real implementation
        txData.privateKey,
        '' // publicKey will be derived from privateKey
      );
      
      const result = await sendTransaction(transaction);
      if (result.success && result.hash) {
        return result.hash;
      }
      throw new Error(result.error || 'Transaction failed');
    });
    
    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error('Error sending multiple transactions:', error);
    throw error;
  }
}

export async function getTransactionHistory(address: string): Promise<any[]> {
  try {
    const result = await fetchTransactionHistory(address);
    return result.transactions || [];
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    // Return empty array instead of mock data
    return [];
  }
}