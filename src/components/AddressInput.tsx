import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onResolvedAddress?: (address: string) => void;
}

export function AddressInput({ 
  value, 
  onChange, 
  placeholder = "oct...", 
  disabled = false,
  className = "",
  onResolvedAddress
}: AddressInputProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  useEffect(() => {
    const resolveInput = async () => {
      if (!value.trim()) {
        setResolvedAddress(null);
        setResolutionError(null);
        return;
      }

      // If it's already a valid OCT address, no need to resolve
      if (value.startsWith('oct') && value.length > 40) {
        setResolvedAddress(value);
        setResolutionError(null);
        onResolvedAddress?.(value);
        return;
      }

      setResolvedAddress(null);
      setResolutionError('Invalid address format');
      onResolvedAddress?.('');
    };

    const timeoutId = setTimeout(resolveInput, 500);
    return () => clearTimeout(timeoutId);
  }, [value, onResolvedAddress]);

  const getStatusIcon = () => {
    if (isResolving) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (resolvedAddress) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    if (resolutionError && value.trim()) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    
    return null;
  };

  const getStatusBadge = () => {
    if (!value.trim()) return null;
    
    if (isResolving) {
      return <Badge variant="secondary" className="text-xs">Resolving...</Badge>;
    }
    
    if (resolvedAddress) {
      return <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">Address</Badge>;
    }
    
    if (resolutionError) {
      return <Badge variant="destructive" className="text-xs">Invalid</Badge>;
    }
    
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-10 ${className}`}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {resolutionError && value.trim() && (
            <span className="text-xs text-red-600">{resolutionError}</span>
          )}
        </div>
      </div>
    </div>
  );
}