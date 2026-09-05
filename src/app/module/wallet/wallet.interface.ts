export interface IMeterRechargePayload {
  userId: string; // customerId এর বদলে ডাইনামিক userId করা হলো
  amount: number;
  meterNumber: string;
}

export interface IWalletResponse {
  success: boolean;
  message: string;
  balance?: number;
}
