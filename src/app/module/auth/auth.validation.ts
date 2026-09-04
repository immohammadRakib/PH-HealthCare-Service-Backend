// import z from "zod";

//  const PatientRegistrationZodSchema = z.object({
//     name: z.string("Not A String!!!!!").min(3, "Name must atleast 3 characters long!!!").max(30),
//     email: z.email("Not email!!"),
//     password: z.string()
//         .min(8, "Password Must Minimum 8 Characters Long.")
//         .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
//         .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

//         .regex(/[0-9]/, "Password must contain atleast 1 Number")
//         .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
//     patient: z.object({
//         contactNumber: z.string().optional()
//     }).optional()
// })


//  const PatientEmailVerifyZodSchema = z.object({
    
//     email: z.email("Not email!!"),
//      otp: z.string().length(6)
   
// })

// const LoginZodSchema = z.object({
//     email : z.email(),
//     password: z.string()
//         .min(8, "Password Must Minimum 8 Characters Long.")
//         .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
//         .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

//         .regex(/[0-9]/, "Password must contain atleast 1 Number")
//         .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
// })

// const ForgotPasswordZodSchema = z.object({
//     email: z.email()
// })

// const ResetPasswordZodSchema = z.object({
//     email: z.email(),
//     newPassword: z.string()
//         .min(8, "Password Must Minimum 8 Characters Long.")
//         .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
//         .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

//         .regex(/[0-9]/, "Password must contain atleast 1 Number")
//         .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
//     otp : z.string().length(6)
// })

// export const UserValidation = {
//     PatientRegistrationZodSchema,
//     LoginZodSchema,
//     ForgotPasswordZodSchema,
//     ResetPasswordZodSchema,
//     PatientEmailVerifyZodSchema
// }



import z from "zod";

// ১. ডাইনামিক ইউজার রেজিস্ট্রেশন ভ্যালিডেশন
const UserRegistrationZodSchema = z.object({
    name: z.string()
        .min(3, "Name must atleast 3 characters long!!!")
        .max(30),
    email: z.string().email("Not email!!"),
    password: z.string()
        .min(8, "Password Must Minimum 8 Characters Long.")
        .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
        .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
        .regex(/[0-9]/, "Password must contain atleast 1 Number")
        .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
    role: z.string().min(1, "Role is required!!!"), // 👈 এখানে ওভারলোড এররটি চিরতরে ফিক্স করা হলো
});

// ২. ইমেইল ভেরিফিকেশন স্কিমা
const UserEmailVerifyZodSchema = z.object({
    email: z.string().email("Not email!!"),
    otp: z.string().length(6)
});

// ৩. লগইন ভ্যালিডেশন স্কিমা
const LoginZodSchema = z.object({
    email: z.string().email("Not email!!"),
    password: z.string()
        .min(8, "Password Must Minimum 8 Characters Long.")
        .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
        .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
        .regex(/[0-9]/, "Password must contain atleast 1 Number")
        .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
});

// ৪. ফরগট পাসওয়ার্ড স্কিমা
const ForgotPasswordZodSchema = z.object({
    email: z.string().email("Not email!!")
});

// ৫. রিসেট পাসওয়ার্ড স্কিমা
const ResetPasswordZodSchema = z.object({
    email: z.string().email("Not email!!"),
    newPassword: z.string()
        .min(8, "Password Must Minimum 8 Characters Long.")
        .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
        .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
        .regex(/[0-9]/, "Password must contain atleast 1 Number")
        .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
    otp: z.string().length(6)
});

export const UserValidation = {
    UserRegistrationZodSchema,
    UserEmailVerifyZodSchema,
    LoginZodSchema,
    ForgotPasswordZodSchema,
    ResetPasswordZodSchema,
};
