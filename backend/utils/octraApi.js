const fetch = require('node-fetch');

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';

// Fetch transaction details from Octra network
async function fetchTransactionDetails(txHash) {
  try {
    const response = await fetch(`${OCTRA_RPC_URL}/tx/${txHash}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OCT-Domain-Backend/1.0.0'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Transaction not found
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error fetching transaction details:', error);
    throw error;
  }
}

// Fetch address information from Octra network
async function fetchAddressInfo(address) {
  try {
    const response = await fetch(`${OCTRA_RPC_URL}/address/${address}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OCT-Domain-Backend/1.0.0'
      },
      timeout: 10000
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Address not found
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error fetching address info:', error);
    throw error;
  }
}

// Check if transaction exists in staging (pending)
async function checkStagingTransaction(txHash) {
  try {
    const response = await fetch(`${OCTRA_RPC_URL}/staging`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OCT-Domain-Backend/1.0.0'
      },
      timeout: 10000
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.staged_transactions && Array.isArray(data.staged_transactions)) {
      const transaction = data.staged_transactions.find(tx => tx.hash === txHash);
      return transaction || null;
    }

    return null;

  } catch (error) {
    console.error('Error checking staging transaction:', error);
    return null;
  }
}

// Verify domain registration transaction
async function verifyDomainRegistration(txHash, fromAddress, domain) {
  const masterAddress = process.env.MASTER_WALLET_ADDRESS;
  
  if (!masterAddress) {
    console.warn('MASTER_WALLET_ADDRESS not configured');
    return { valid: false, reason: 'Master address not configured' };
  }

  try {
    // First check confirmed transactions
    let txDetails = await fetchTransactionDetails(txHash);
    
    // If not found in confirmed, check staging
    if (!txDetails) {
      const stagingTx = await checkStagingTransaction(txHash);
      if (stagingTx) {
        txDetails = {
          parsed_tx: {
            from: stagingTx.from,
            to: stagingTx.to,
            amount: stagingTx.amount,
            message: stagingTx.message
          }
        };
      }
    }

    if (!txDetails) {
      return { valid: false, reason: 'Transaction not found' };
    }

    const expectedMessage = `register_domain:${domain.toLowerCase()}`;
    
    // Verify transaction parameters
    const checks = {
      fromAddress: txDetails.parsed_tx.from === fromAddress,
      toAddress: txDetails.parsed_tx.to === masterAddress,
      amount: parseFloat(txDetails.parsed_tx.amount) === 0,
      message: txDetails.parsed_tx.message === expectedMessage
    };

    const isValid = Object.values(checks).every(check => check === true);

    return {
      valid: isValid,
      checks,
      transaction: txDetails.parsed_tx,
      expected: {
        from: fromAddress,
        to: masterAddress,
        amount: 0,
        message: expectedMessage
      }
    };

  } catch (error) {
    console.error('Error verifying domain registration:', error);
    return { valid: false, reason: error.message };
  }
}

module.exports = {
  fetchTransactionDetails,
  fetchAddressInfo,
  checkStagingTransaction,
  verifyDomainRegistration
};