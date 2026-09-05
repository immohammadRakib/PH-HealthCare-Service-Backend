import { Request, Response } from "express";
import { WalletService } from "./wallet.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";

// ১. কাস্টমার নিজের ব্যালেন্স চেক করবে (টোকেন থেকে ডাইনামিকলি)
const getMyBalance = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user; 
  const userId = user?.id || user?.userId || req.query.userId; 

  if (!userId) {
    throw new Error("Authentication failed! User ID not found.");
  }

  const result = await WalletService.getCustomerBalance(userId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: {
      balance: result.balance
    }
  });
});

// ২. স্ট্রাইপ চেকআউট সেশন চালু করার কন্ট্রোলার (কোনো customerId বডিতে লাগবে না!)
const rechargeMeter = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user; 

  const payload = {
    userId: (user?.id || user?.userId) as string, 
    amount: Number(req.body.amount), // ফ্রন্টএন্ড থেকে পাঠানো ডলার (যেমন: 0.50, 5.00)
    meterNumber: req.body.meterNumber
  };

  if (!payload.userId && req.body.userId) {
    payload.userId = req.body.userId;
  }

  if (!payload.userId) {
    throw new Error("Authentication failed! User ID not found in token.");
  }

  // 👑 এখানে পরিবর্তন: ম্যানুয়াল রিচার্জের বদলে সরাসরি স্ট্রাইপ পেমেন্ট সেশন কল হবে
  const result = await WalletService.createCheckoutSession(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: {
      paymentUrl: result.paymentUrl // ফ্রন্টএন্ড এই লিংকটি নিয়ে উইন্ডো রিডাইরেক্ট করবে
    }
  });
});

// ৩. পেমেন্ট সাকসেস হওয়ার পর স্ট্রাইপ স্বয়ংক্রিয়ভাবে এখানে কাস্টমারকে ব্যাক করাবে
const handleStripeSuccess = catchAsync(async (req: Request, res: Response) => {
  const { userId, amount, meterNumber } = req.query;

  // পেমেন্ট গেটওয়ে সফল হওয়া মাত্রই আমাদের সার্ভিস লেয়ারের রিচার্জ লজিক কল হয়ে ব্যালেন্স আপডেট হবে!
  await WalletService.rechargeMeterBalance({
    userId: userId as string,
    amount: Number(amount),
    meterNumber: meterNumber as string
  });

  // ব্রাউজারে একটি চমৎকার রেডিমেড HTML সাকসেস স্ক্রিন শো করা
  res.send(`
    <div style="text-align: center; margin-top: 120px; font-family: sans-serif;">
      <div style="display: inline-block; background: #e8f8f5; padding: 25px; border-radius: 50%; margin-bottom: 15px;">
        <span style="font-size: 50px; color: #2ecc71;">⚡</span>
      </div>
      <h1 style="color: #2ecc71; font-size: 32px; margin-bottom: 10px;">Payment & Meter Recharge Successful!</h1>
      <p style="color: #7f8c8d; font-size: 18px; margin-bottom: 30px;">BDT/USD ${amount} has been securely credited to Meter No: <strong>${meterNumber}</strong></p>
      <a href="http://localhost:3000/dashboard" style="padding: 12px 25px; background: #3498db; color: white; text-decoration: none; border-radius: 25px; font-weight: bold; font-family: sans-serif;">Back to Grid Dashboard</a>
    </div>
  `);
});

// ৪. পেমেন্ট ফেইল বা ক্যানসেল হলে
const handleStripeCancel = catchAsync(async (req: Request, res: Response) => {
  res.send(`
    <div style="text-align: center; margin-top: 120px; font-family: sans-serif;">
      <h1 style="color: #e74c3c;">❌ Payment Cancelled or Failed!</h1>
      <p>The transaction was aborted. No amount was deducted from your card.</p>
      <a href="http://localhost:3000/dashboard" style="color: #3498db; text-decoration: none; font-weight: bold;">Try Again</a>
    </div>
  `);
});

export const WalletController = {
  rechargeMeter,
  getMyBalance,
  handleStripeSuccess,
  handleStripeCancel
};
