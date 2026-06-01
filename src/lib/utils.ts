import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function getDisplayUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('data:image')) {
    return url;
  }
  
  if (url.includes('drive.google.com')) {
    // Try matching parameter id=
    let idMatch = url.match(/[?&]id=([-\w]{25,})/);
    if (idMatch && idMatch[1]) {
      return `/api/drive/proxy?id=${idMatch[1]}`;
    }
    // Try matching /file/d/ID
    idMatch = url.match(/\/file\/d\/([-\w]{25,})/);
    if (idMatch && idMatch[1]) {
      return `/api/drive/proxy?id=${idMatch[1]}`;
    }
    // Fallback search for any string that looks like a drive ID
    idMatch = url.match(/([-\w]{25,})/);
    if (idMatch && idMatch[0]) {
      return `/api/drive/proxy?id=${idMatch[0]}`;
    }
  }
  
  return url;
}

