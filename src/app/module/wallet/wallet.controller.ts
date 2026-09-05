import { Request, Response } from "express";
import { WalletService } from "./wallet.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";

// ১. কাস্টমার নিজের ব্যালেন্স চেক করবে (টোকেন থেকে ডাইনামিকলি)
const getMyBalance = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user; // JWT থেকে আসা ইউজার ডাটা
  const userId = user?.id || user?.userId || req.query.userId; // টোকেন বা কুয়েরি থেকে

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

// ২. কাস্টমার মিটার রিচার্জ করবে (কোনো customerId বডিতে লাগবে না!)
const rechargeMeter = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user; 

  const payload = {
    userId: user?.id || user?.userId, // টোকেন থেকে আসা মেইন ইউজার আইডি
    amount: Number(req.body.amount),
    meterNumber: req.body.meterNumber
  };

  // যদি টোকেন না থাকে (লোকাল টেস্টের জন্য ব্যাকআপ)
  if (!payload.userId && req.body.userId) {
    payload.userId = req.body.userId;
  }

  if (!payload.userId) {
    throw new Error("Authentication failed! User ID not found in token.");
  }

  const result = await WalletService.rechargeMeterBalance(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: {
      currentBalance: result.balance
    }
  });
});

// 💡 ফিক্সড এক্সপোর্ট: এখন আর কোনো Circular Reference এরর আসবে না
export const WalletController = {
  rechargeMeter,
  getMyBalance
};
