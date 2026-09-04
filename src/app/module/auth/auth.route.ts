import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";

const router = Router();

router.post("/register", validateRequest(UserValidation.UserRegistrationZodSchema), AuthController.registerPatient);
router.post("/verify-email",
	validateRequest(UserValidation.UserEmailVerifyZodSchema),
	 AuthController.verifyPatientEmail);
router.post("/login", validateRequest(UserValidation.LoginZodSchema), AuthController.loginUser);
// router.get(
// 	"/me",
// 	auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
// 	AuthController.getMe,
// );

router.get(
  "/me",
  // ⚡ তোমার নতুন প্রজেক্টের ৬টি রোলকেই এখানে অ্যাক্সেস দেওয়া হলো, যাতে সবাই তার প্রোফাইল দেখতে পারে
  auth(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.ZONE_MANAGER,
    Role.POWER_OPERATOR,
    Role.TECHNICIAN,
    Role.CUSTOMER
  ),
  AuthController.getMe
);

router.post("/refresh-token", AuthController.refreshToken);

router.post("/google", AuthController.googleLogin)

router.post("/forgot-password",
	validateRequest(UserValidation.ForgotPasswordZodSchema),
	 AuthController.forgotPassword);
router.post("/reset-password",
	validateRequest(UserValidation.ResetPasswordZodSchema),
	 AuthController.resetPassword);
export const AuthRoutes = router;
	