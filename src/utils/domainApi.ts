import { DomainRegistrationRequest, DomainRegistrationResult, DomainLookupResult } from '../types/domain';
import { createTransaction, sendTransaction, fetchBalance } from './api';
import * as nacl from 'tweetnacl';
import { base64ToBuffer, bufferToHex } from './crypto';

// Get domain master address from environment variables
const DOMAIN_MASTER_ADDRESS = import.meta.env.VITE_DOMAIN_MASTER_ADDRESS || 'oct8UYokvM1DR2QpTD4mncgvRzfM6f9yDuRR1gmBASgTk8d';
const DOMAIN_API_BACKEND = '/domain-api';

export async function registerDomain(request: DomainRegistrationRequest): Promise<DomainRegistrationResult> {
  try {
    // Validate domain format
    if (!isValidDomainFormat(request.domain)) {
      return { success: false, error: 'Invalid domain format. Use only letters, numbers, and hyphens.' };
    }

    // Check if domain is already registered
    const existingDomain = await lookupDomain(request.domain);
    if (existingDomain.found) {
      return { success: false, error: 'Domain is already registered' };
    }

    // Get current nonce
    const balanceData = await fetchBalance(request.ownerAddress);
    
    // Derive public key from private key
    const privateKeyBuffer = base64ToBuffer(request.privateKey);
    const keyPair = nacl.sign.keyPair.fromSeed(privateKeyBuffer);
    const publicKeyHex = bufferToHex(Buffer.from(keyPair.publicKey));
    
    // Create registration message
    const registrationMessage = `register_domain:${request.domain}`;
    
    // Create transaction to master address with 0 OCT and registration message
    const transaction = createTransaction(
      request.ownerAddress,
      DOMAIN_MASTER_ADDRESS,
      0, // 0 OCT amount
      balanceData.nonce + 1,
      request.privateKey,
      publicKeyHex, // Properly derived public key
      registrationMessage
    );

    // Send transaction
    const result = await sendTransaction(transaction);
    
    if (result.success && result.hash) {
      // Store domain registration in backend
      await storeDomainRegistration({
        domain: request.domain,
        address: request.ownerAddress,
        txHash: result.hash,
        registeredAt: Date.now()
      });

      return { success: true, txHash: result.hash };
    } else {
      return { success: false, error: result.error || 'Transaction failed' };
    }
  } catch (error) {
    console.error('Domain registration error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function lookupDomain(domain: string): Promise<DomainLookupResult> {
  try {
    const response = await fetch(`${DOMAIN_API_BACKEND}/lookup/${domain}`);
    
    if (response.ok) {
      const data = await response.json();
      return {
        found: true,
        address: data.address,
        domain: data.domain
      };
    } else if (response.status === 404) {
      return { found: false };
    } else {
      throw new Error('Failed to lookup domain');
    }
  } catch (error) {
    console.error('Domain lookup error:', error);
    return { found: false };
  }
}

export async function lookupAddress(address: string): Promise<DomainLookupResult> {
  try {
    const response = await fetch(`${DOMAIN_API_BACKEND}/reverse/${address}`);
    
    if (response.ok) {
      const data = await response.json();
      return {
        found: true,
        address: data.address,
        domain: data.domain
      };
    } else if (response.status === 404) {
      return { found: false };
    } else {
      throw new Error('Failed to lookup address');
    }
  } catch (error) {
    console.error('Address lookup error:', error);
    return { found: false };
  }
}

export async function getAddressDomains(address: string): Promise<{ domains: Array<{ domain: string; registeredAt: number }>, count: number }> {
  try {
    const response = await fetch(`${DOMAIN_API_BACKEND}/address/${address}/domains`);
    
    if (response.ok) {
      const data = await response.json();
      return {
        domains: data.domains || [],
        count: data.count || 0
      };
    } else {
      return { domains: [], count: 0 };
    }
  } catch (error) {
    console.error('Error fetching address domains:', error);
    return { domains: [], count: 0 };
  }
}

async function storeDomainRegistration(registration: any): Promise<void> {
  try {
    const response = await fetch(`${DOMAIN_API_BACKEND}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registration),
    });

    if (!response.ok) {
      throw new Error('Failed to store domain registration');
    }
  } catch (error) {
    console.error('Failed to store domain registration:', error);
    throw error;
  }
}

export function isValidDomainFormat(domain: string): boolean {
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

export function isOctDomain(input: string): boolean {
  return input.endsWith('.oct') && isValidDomainFormat(input);
}

export async function resolveAddressOrDomain(input: string): Promise<string> {
  const trimmedInput = input.trim();
  
  // If it's already an OCT address, return as is
  if (trimmedInput.startsWith('oct') && trimmedInput.length > 40) {
    return trimmedInput;
  }
  
  // If it's a domain, resolve it
  if (isOctDomain(trimmedInput)) {
    const lookup = await lookupDomain(trimmedInput);
    if (lookup.found && lookup.address) {
      return lookup.address;
    } else {
      throw new Error(`Domain ${trimmedInput} not found`);
    }
  }
  
  // If it doesn't match either format, throw error
  throw new Error('Invalid address or domain format');
}