import express from "express";
import { OutageController } from "./outage.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = express.Router();

// ১. হঠাৎ কারেন্ট চলে গেলে কাস্টমার কমপ্লেন করবে (Protected - Only CUSTOMER)
router.post(
  "/report",
  auth(Role.CUSTOMER),
  OutageController.reportUnexpectedOutage
);

// ২. টেকনিশিয়ান মাঠে গিয়ে কাজ শেষ করে বিদ্যুৎ সচল করবে (Protected - Only TECHNICIAN)
// এখানে রাউট প্যারামিটার হিসেবে :reportId পাস করা হয়েছে
router.patch(
  "/resolve/:reportId",
  auth(Role.TECHNICIAN),
  OutageController.resolveOutageJob
);

// ৩. কাস্টমার বা এডমিন যে কেউ তার এরিয়ার লাইভ বিদ্যুৎ পরিস্থিতি দেখবে (Protected/Public)
router.get(
  "/live-status",
  auth(Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN),
  OutageController.getMyAreaLiveStatus
);

export const OutageRoutes = router;
