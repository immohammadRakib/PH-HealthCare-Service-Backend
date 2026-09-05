import express from "express";
import { WalletController } from "./wallet.controller";
import { auth } from "../../middleware/checkAuth"; // আপনার প্রজেক্টের অথ মিডলওয়্যার পাথ
import { Role } from "../../../generated/prisma/enums";

const router = express.Router();

// ১. কাস্টমারের নিজের ব্যালেন্স দেখার সিকিউর রাউট
router.get(
  "/my-balance",
  auth(Role.CUSTOMER),
  WalletController.getMyBalance
);

// ২. কাস্টমারের মিটার রিচার্জ (Stripe Checkout Session) শুরু করার রাউট
router.post(
  "/recharge",
  auth(Role.CUSTOMER),
  WalletController.rechargeMeter
);

// 💡 ৩. স্ট্রাইপ কলব্যাক এন্ডপয়েন্টস (পাবলিক রাউট - নো অথ মিডলওয়্যার)
router.get("/stripe-success", WalletController.handleStripeSuccess);
router.get("/stripe-cancel", WalletController.handleStripeCancel);

export const WalletRoutes = router;
