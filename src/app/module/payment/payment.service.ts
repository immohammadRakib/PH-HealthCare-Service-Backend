import Stripe from "stripe";
import config from "../config"; // আপনার env কনফিগ পাথ অনুযায়ী

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "YOUR_SECRET_KEY", {
  apiVersion: "2025-01-27" as any, 
});

const createCheckoutSession = async (payload: ICreateCheckoutPayload) => {
  const { userId, amount, meterNumber } = payload;

  if (amount < 0.50) {
    throw new Error("Minimum payment amount for Stripe is 0.50 USD (approx. 60 BDT)");
  }

  // স্ট্রাইপ চেকআউট সেশন তৈরি করা
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Smart Grid Prepaid Meter Token (Meter: ${meterNumber})`,
            description: "Electricity utility automated wallet top-up",
          },
          unit_amount: Math.round(amount * 100), // সেন্টে কনভার্ট (যেমন: $0.50 = 50 cents)
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    // পেমেন্ট সফল হলে স্ট্রাইপ এই সাকসেস লিংকে ব্যাক করাবে
    success_url: `http://localhost:5000/api/v1/payment/stripe-success?userId=${userId}&amount=${amount}&meterNumber=${meterNumber}`,
    cancel_url: `http://localhost:5000/api/v1/payment/stripe-cancel`,
  });

  return {
    paymentUrl: session.url, // কাস্টমার এই লিংকে গিয়ে পেমেন্ট করবে
  };
};

export const PaymentService = {
  createCheckoutSession,
};
