import { Timestamp } from 'firebase/firestore';

export interface Warranty {
  id?: string;
  projectName: string;
  vendor: string;
  expiryDate: Timestamp;
  deposit: number;
  issueRemark: string;
  warrantyScope?: string;
  isRefunded: boolean;
  hasIssue: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ROCDate {
  year: number;
  month: number;
  day: number;
}
