export interface OctDomain {
  domain: string;
  address: string;
  registeredAt: number;
  txHash: string;
}

export interface DomainRegistrationRequest {
  domain: string;
  ownerAddress: string;
  privateKey: string;
}

export interface DomainRegistrationResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface DomainLookupResult {
  found: boolean;
  address?: string;
  domain?: string;
}