import { prisma } from "../../lib/prisma"; // আপনার প্রিজমা ক্লায়েন্ট পাথ অনুযায়ী
import { IMeterRechargePayload, IWalletResponse } from "./wallet.interface";
import Stripe from "stripe";
import config from "../../config"; // আপনার কনফিগারেশন ফাইল পাথ অনুযায়ী

// 💡 স্ট্রাইপ ক্লায়েন্ট ইনিশিয়েশন
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || config.stripe_secret_key as string, {
  apiVersion: '2026-08-26.dahlia' as any, 
});

// ==========================================
// ১. কাস্টমারের কারেন্ট ওয়ালেট ব্যালেন্স দেখা
// ==========================================
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

// ==========================================
// ২. মিটার রিচার্জ ইঞ্জিন (পেমেন্ট সাকসেস হওয়ার পর এটি ব্যাকএন্ড থেকে কল হবে)
// ==========================================
const rechargeMeterBalance = async (payload: IMeterRechargePayload): Promise<IWalletResponse> => {
  const { userId, amount, meterNumber } = payload;

  if (amount <= 0) {
    throw new Error("Recharge amount must be greater than 0!");
  }

  return await prisma.$transaction(async (tx) => {
    
    // ওয়ান-টু-ওয়ান রিলেশন ব্যবহার করে লগইনড userId দিয়ে কাস্টমার খোঁজা
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
      where: { id: customer.id }, // কাস্টমারের নিজস্ব প্রাইমারি আইডি
      data: {
        balance: newBalance
      }
    });

    return {
      success: true,
      message: `⚡ Recharge Successful! BDT/USD ${amount} added to your meter.`,
      balance: updatedCustomer.balance
    };
  });
};

// ==========================================
// 👑 ৩. স্ট্রাইপ চেকআউট সেশন ইঞ্জিন (যা আপনি আগে কন্ট্রোলারে কল করেছিলেন)
// ==========================================
const createCheckoutSession = async (payload: IMeterRechargePayload): Promise<IWalletResponse> => {
  const { userId, amount, meterNumber } = payload;

  // স্ট্রাইপের মিনিমাম ৫০০ সেন্ট বা ০.৫০ ডলার রিকোয়ারমেন্ট সেফটি চেক
  if (amount < 0.50) {
    throw new Error("Minimum payment amount for Stripe is 0.50 USD (approx. 60 BDT)");
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd", // আপনি ইন্টারন্যাশনাল কার্ড দিয়ে টেস্ট করার জন্য usd রাখবেন
          product_data: {
            name: `Prepaid Meter Utility Token (Meter: ${meterNumber})`,
            description: "Smart grid automated wallet top-up solution",
          },
          unit_amount: Math.round(amount * 100), // সেন্টে রূপান্তর (যেমন ১ ডলার = ১০০ সেন্ট)
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    // 💡 রাউট ক্লিন রাখার জন্য সাকসেস ইউআরএল সরাসরি ওয়ালেটের এন্ডপয়েন্টেই ট্যাগ করা হলো
    success_url: `http://localhost:5000/api/v1/wallet/stripe-success?userId=${userId}&amount=${amount}&meterNumber=${meterNumber}`,
    cancel_url: `http://localhost:5000/api/v1/wallet/stripe-cancel`,
  });

  return {
    success: true,
    message: "Stripe checkout session initialized successfully.",
    paymentUrl: session.url as string, // এই ইউআরএল-টি ফ্রন্টএন্ডে রিসিভ হবে
  };
};

export const WalletService = {
  getCustomerBalance,
  rechargeMeterBalance,
  createCheckoutSession // 👈 এক্সপোর্টে এটি যুক্ত করে দেওয়া হলো
};
