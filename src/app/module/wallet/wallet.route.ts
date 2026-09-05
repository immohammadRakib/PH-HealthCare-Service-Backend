import express from "express";
import { WalletController } from "./wallet.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = express.Router();

// ১. কাস্টমারের নিজের ব্যালেন্স দেখার রাউট
router.get(
  "/my-balance",
  auth(Role.CUSTOMER),
  WalletController.getMyBalance
);

// ২. কাস্টমারের মিটার রিচার্জ করার রাউট
router.post(
  "/recharge",
  auth(Role.CUSTOMER),
  WalletController.rechargeMeter
);

export const WalletRoutes = router;
