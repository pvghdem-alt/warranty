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

export interface Issue {
  id: string;
  warrantyId: string;
  vendorCompany: string;
  issueName: string;
  status: '未處理' | '維修中' | '待料中' | '待確認' | '已完成';
  createdAt?: any;
  updatedAt?: any;
  vendorReply?: string;
  estRepairTime?: string;
  hasUnreadReply?: boolean;
  returnReason?: string;
  photoUrls?: string[];
  completionPhotoUrls?: string[];
}

export interface FloorPlan {
  id: string;
  warrantyId: string;
  name: string;
  imageUrl: string;
  createdAt?: any;
}

export interface FloorPlanPin {
  id: string;
  planId: string;
  warrantyId: string;
  x: number;
  y: number;
  title: string;
  description: string;
  photoUrl?: string;
  createdAt?: any;
}
