import { prisma } from "../../lib/prisma"; // আপনার প্রিজমা ক্লায়েন্ট পাথ অনুযায়ী
import { IMeterRechargePayload, IWalletResponse } from "./wallet.interface";

// ১. কাস্টমারের কারেন্ট ওয়ালেট ব্যালেন্স দেখা (userId দিয়ে কুয়েরি)
const getCustomerBalance = async (userId: string): Promise<IWalletResponse> => {
  const customerProfile = await prisma.customer.findUnique({
    where: { userId: userId },
    select: { balance: true, meterNumber: true, accountNumber: true }
  });

  if (!customerProfile) {
    throw new Error("Customer profile not found for this logged-in user!");
  }

  return {
    success: true,
    message: "Wallet balance fetched successfully.",
    balance: customerProfile.balance || 0.0
  };
};

// ২. মিটার রিচার্জ ইঞ্জিন (Wallet Balance Top-up)
const rechargeMeterBalance = async (payload: IMeterRechargePayload): Promise<IWalletResponse> => {
  const { userId, amount, meterNumber } = payload;

  if (amount <= 0) {
    throw new Error("Recharge amount must be greater than 0!");
  }

  return await prisma.$transaction(async (tx) => {
    
    // 💡 ম্যাজিক লাইন: ওয়ান-টু-ওয়ান রিলেশন ব্যবহার করে লগইনড userId দিয়ে কাস্টমার খোঁজা
    const customer = await tx.customer.findUnique({
      where: { userId: userId }
    });

    if (!customer) {
      throw new Error("Customer profile not found for this user!");
    }

    // ডাটাবেসের মিটারের সাথে ইনপুট দেওয়া মিটার নম্বর ম্যাচিং চেক
    if (customer.meterNumber && customer.meterNumber !== meterNumber) {
      throw new Error("Meter number mismatch! This meter is not linked to your account.");
    }

    // কাস্টমারের প্রিপেইড মিটারের ব্যালেন্স বৃদ্ধি করা
    const currentBalance = customer.balance || 0.0;
    const newBalance = currentBalance + amount;

    const updatedCustomer = await tx.customer.update({
      where: { id: customer.id }, // কাস্টমারের নিজস্ব প্রাইমারি আইডি দিয়ে আপডেট
      data: {
        balance: newBalance
      }
    });

    return {
      success: true,
      message: `⚡ Recharge Successful! BDT ${amount} added to your meter.`,
      balance: updatedCustomer.balance
    };
  });
};

export const WalletService = {
  getCustomerBalance,
  rechargeMeterBalance
};
