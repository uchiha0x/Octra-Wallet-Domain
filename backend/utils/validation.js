const { fetchTransactionDetails } = require('./octraApi');

// Get domain master address from environment variables
const DOMAIN_MASTER_ADDRESS = process.env.DOMAIN_MASTER_ADDRESS || 'oct1234567890abcdef1234567890abcdef12345678';

// Validate domain format
function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  // Domain should end with .oct
  if (!domain.endsWith('.oct')) {
    return false;
  }

  // Remove .oct suffix for validation
  const name = domain.slice(0, -4);
  
  // Check length (3-32 characters)
  if (name.length < 3 || name.length > 32) {
    return false;
  }

  // Check format: only letters, numbers, and hyphens
  // Cannot start or end with hyphen
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  return domainRegex.test(name);
}

// Validate OCT address format
function isValidOctAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // OCT address should start with 'oct' and be around 47 characters total
  const octAddressRegex = /^oct[1-9A-HJ-NP-Za-km-z]{44}$/;
  return octAddressRegex.test(address);
}

// Verify transaction on blockchain
async function verifyTransaction(txHash, fromAddress, domain) {
  try {
    const masterAddress = DOMAIN_MASTER_ADDRESS;
    if (!masterAddress) {
      console.warn('DOMAIN_MASTER_ADDRESS not configured, skipping verification');
      return true; // Skip verification if not configured
    }

    // Fetch transaction details from Octra network
    const txDetails = await fetchTransactionDetails(txHash);
    
    if (!txDetails) {
      console.warn(`Transaction not found: ${txHash}`);
      return false;
    }

    // Verify transaction details
    const isValidTx = (
      txDetails.parsed_tx.from === fromAddress &&
      txDetails.parsed_tx.to === masterAddress &&
      parseFloat(txDetails.parsed_tx.amount) === 0 &&
      txDetails.parsed_tx.message === `register_domain:${domain.toLowerCase()}`
    );

    if (!isValidTx) {
      console.warn('Transaction verification failed:', {
        expected: {
          from: fromAddress,
          to: masterAddress,
          amount: 0,
          message: `register_domain:${domain.toLowerCase()}`
        },
        actual: {
          from: txDetails.parsed_tx.from,
          to: txDetails.parsed_tx.to,
          amount: txDetails.parsed_tx.amount,
          message: txDetails.parsed_tx.message
        }
      });
    }

    return isValidTx;

  } catch (error) {
    console.error('Transaction verification error:', error);
    return false;
  }
}

// Sanitize domain name
function sanitizeDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return '';
  }
  
  return domain.toLowerCase().trim();
}

// Check if domain is reserved
function isReservedDomain(domain) {
  const reservedDomains = [
    'admin.oct',
    'root.oct',
    'api.oct',
    'www.oct',
    'mail.oct',
    'ftp.oct',
    'localhost.oct',
    'octra.oct',
    'oct.oct'
  ];
  
  return reservedDomains.includes(domain.toLowerCase());
}

module.exports = {
  validateDomain,
  isValidOctAddress,
  verifyTransaction,
  sanitizeDomain,
  isReservedDomain
};