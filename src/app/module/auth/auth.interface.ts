// import type { Role } from "../../../generated/prisma/browser";

// export interface ILoginUserPayload {
// 	email: string;
// 	password: string;
// }

// export interface IRegisterUserPayload {
// 	name: string;
// 	email: string;
// 	password: string;
// 	role: Role;
// }

// export interface IVerifyEmailPayload {
// 	email: string;
// 	otp : string;
// }

// export interface IRequestUser {
// 	userId: string;
// 	email: string;
// 	name: string;
// 	role: Role;
// }

// export interface IGoogleLogin {
// 	idToken: string;
// }

// export interface IForgotPasswordPayload {
// 	email : string
// }
// export interface IResetPasswordPayload {
// 	email : string;
// 	newPassword : string;
// 	otp : string;
// }





import type { Role } from "../../../generated/prisma/browser";

export interface ILoginUserPayload {
	email: string;
	password: string;
}

// 💡 শর্টকাট ও ক্লিন রেজিস্ট্রেশন ইন্টারফেস (গুগল লগইনের সাথে সিঙ্ক করা)
export interface IRegisterUserPayload {
	name: string;
	email: string;
	password?: string; // গুগলের ক্ষেত্রে পাসওয়ার্ড থাকবে না, তাই optional (?) রাখা হয়েছে
	role: Role;        // কাস্টমার নিজে CUSTOMER সিলেক্ট করবে, অ্যাডমিন প্যানেল থেকে বাকি রোল ক্রিয়েট হবে
}
	
export interface IVerifyEmailPayload {
	email: string;
	otp: string;
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}

export interface IGoogleLogin {
	idToken: string;
}

export interface IForgotPasswordPayload {
	email: string;
}

export interface IResetPasswordPayload {
	email: string;
	newPassword: string;
	otp: string;
}
