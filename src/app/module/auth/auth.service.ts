import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
  AuthProvider,
  Role,
  UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import crypto from "crypto";
import path from "path";
import ejs from "ejs";
import { prisma } from "../../lib/prisma";
import { transporter } from "../../lib/nodemailer";
import { jwtUtils } from "../../utils/jwt";
import type {
  IGoogleLogin,
  ILoginUserPayload,
  IRegisterUserPayload,
  IRequestUser,
  IForgotPasswordPayload,
  IVerifyEmailPayload,
  IResetPasswordPayload
} from "./auth.interface";
import { redisClient } from "../../lib/redis";
import { TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleAuth";
import { BlockList } from "net";

// const registerPatient = async (payload: IRegisterPatientPayload) => {
//   const { name, password } = payload;
//   const email = payload.email.trim().toLowerCase();

//   const isUserExists = await prisma.user.findUnique({
//     where: { email },
//   });

//   if (isUserExists) {
//     throw new Error("User with this email already exists");
//   }

//   const hashedPassword = await bcrypt.hash(password, 8);

//   const createdUser = await prisma.user.create({
//     data: {
//       name,
//       email,
//       password: hashedPassword,
//       role: Role.PATIENT,
//       status: UserStatus.ACTIVE,
//       emailVerified: false,
//       patient: {
//         create: { name, email },
//       },
//     },
//     omit: { password: true },
//     include: { patient: true },
//   });

//   const { patient, ...user } = createdUser;
//   const jwtPayload = {
//     userId: user.id,
//     name: user.name,
//     email: user.email,
//     role: user.role,
//   };

//   const accessToken = jwtUtils.createToken(
//     jwtPayload,
//     config.jwt_access_secret,
//     config.jwt_access_expires_in as SignOptions,
//   );

//   const refreshToken = jwtUtils.createToken(
//     jwtPayload,
//     config.jwt_refresh_secret,
//     config.jwt_refresh_expires_in as SignOptions,
//   );

//   return {
//     user,
//     patient,
//     accessToken,
//     refreshToken,
//   };
// };

const registerUser = async (payload: IRegisterUserPayload) => {
  const { name, role, password } = payload;
  const email = payload.email.trim().toLowerCase();

  // ১. ইমেইল অলরেডি ডাটাবেসে আছে কিনা চেক করা
  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new Error("User with this email already exists");
  }

  // ২. পাসওয়ার্ড হ্যাশিং (গুগল সাইন-ইন হলে পাসওয়ার্ড ছাড়া আসবে, তাই এটি নাল হ্যান্ডেল করবে)
  const hashedPassword = password ? await bcrypt.hash(password, 8) : null;

  // ৩. প্রিসমা ট্রানজেকশন দিয়ে শুধুমাত্র বেসিক প্রোফাইল খালি রেখে ইনিশিয়ালাইজ করা
  const createdUser = await prisma.$transaction(async (tx) => {
    
    // ক) মেইন ইউজার টেবিল ক্রিয়েশন
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as Role,
        status: UserStatus.ACTIVE,
      },
    });

    let profileData = null;

    // খ) সুইচ কেস - শুধুমাত্র রোল অনুযায়ী একদম খালি (Empty) প্রোফাইল অবজেক্ট তৈরি
    switch (role) {
      case Role.CUSTOMER:
        profileData = await tx.customer.create({
          data: {
            userId: user.id,
            accountNumber: `ACC-${Date.now().toString().slice(-6)}`, // সাময়িক ট্র্যাকিং আইডি
            meterNumber: `MTR-${Date.now().toString().slice(-6)}`,
            balance: 0.0,
            areaId: null,           // টেবিল সম্পূর্ণ খালি থাকবে
            billingAddress: null,
          },
        });
        break;

      case Role.TECHNICIAN:
        profileData = await tx.technician.create({
          data: {
            userId: user.id,
            status: "AVAILABLE",
            zoneId: null,           // টেবিল সম্পূর্ণ খালি থাকবে
            specialization: null,
          },
        });
        break;

      case Role.ZONE_MANAGER:
        profileData = await tx.zoneManager.create({
          data: {
            userId: user.id,
            zoneId: null,           // টেবিল সম্পূর্ণ খালি থাকবে
            officeRoomNo: null,
          },
        });
        break;

      case Role.POWER_OPERATOR:
        profileData = await tx.powerOperator.create({
          data: {
            userId: user.id,
            substationId: null,     // টেবিল সম্পূর্ণ খালি থাকবে
            shift: null,
          },
        });
        break;

      case Role.ADMIN:
      case Role.SUPER_ADMIN:
        // এডমিনদের আলাদা কোনো চাইল্ড টেবিল নেই
        break;

      default:
        throw new Error("Invalid User Role provided");
    }

    return {
      user,
      profile: profileData,
    };
  });

  // ৪. রেসপন্স এবং JWT টোকেন জেনারেট করা
  const { password: _, ...userResponse } = createdUser.user;

  const jwtPayload = {
    userId: userResponse.id,
    name: userResponse.name,
    email: userResponse.email,
    role: userResponse.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    user: userResponse,
    profile: createdUser.profile, 
    accessToken,
    refreshToken,
  };
};



// const verifyPatientEmail = async (payload : IVerifyEmailPayload) => {

// 	const otp = payload.otp;
// 	const email = payload.email.trim().toLowerCase();

// 	const isUserExist = await prisma.user.findUnique({
// 		where: { email },
// 	});

// 	if (isUserExist?.status === "BLOCKED") {
// 		throw new Error("User is Blocked")
// 	}

// 	if (isUserExist?.emailVerified) {
// 		throw new Error("Email ALready Verified")
// 	}

// 	if (isUserExist?.isDeleted || isUserExist?.status === "DELETED") {
// 		throw new Error("User is Deleted")
// 	}

// 	const otpKey = `patient-registration-otp:${email}`

// 	const redisOtp = await redisClient.get(otpKey)

// 	if (!redisOtp) {
// 		throw new Error("Invalid OTP")
// 	}

// 	if (redisOtp !== otp) {
// 		throw new Error("OTP Does Not Match")
// 	}

// 	await redisClient.del(otpKey)

// 	const patientRegistrationKey = `patient-registration-data:${email}`

// 	const redisPatientData = await redisClient.get(patientRegistrationKey)

// 	if(!redisPatientData){
// 		throw new Error ("Patient Doesnt Exist");
// 	}

// 	const patientPayload : IRegisterUserPayload = JSON.parse(redisPatientData)

// 	const createdUser = await prisma.user.create({
// 		data: {
// 			name : patientPayload.name,
// 			email : patientPayload.email,
// 			password: patientPayload.password,
// 			role: Role.PATIENT,
// 			status: UserStatus.ACTIVE,
// 			emailVerified: true,
// 			patient: {
// 				create: {
// 					name: patientPayload.name,
// 					email: patientPayload.email, 
// 					contactNumber: patientPayload?.patient?.contactNumber || "" },
// 			},
// 		},
// 		omit: { password: true },
// 		include: { patient: true },
// 	});

// 	await redisClient.del(patientRegistrationKey)

// 	const tempatePath = path.join(process.cwd(), "src/app/templates/patient-welcome-email.ejs")

// 	const templateData = {
// 		name : createdUser.name,
// 	}

// 	const html = await ejs.renderFile(tempatePath, templateData)

// 	await transporter.sendMail({
// 		from: config.email_sender,
// 		to: email,
// 		subject: "Welcome To PH Healthcare System",
// 		// text : `Your OTP is ${otp}`
// 		// html: `<h1>Your OTP is ${otp}</h1>`
// 		html
// 	})

// 	const { patient, ...user } = createdUser;
// 	const jwtPayload = {
// 		userId: user.id,
// 		name: user.name,
// 		email: user.email,
// 		role: user.role,
// 	};

// 	const accessToken = jwtUtils.createToken(
// 		jwtPayload,
// 		config.jwt_access_secret,
// 		config.jwt_access_expires_in as SignOptions,
// 	);

// 	const refreshToken = jwtUtils.createToken(
// 		jwtPayload,
// 		config.jwt_refresh_secret,
// 		config.jwt_refresh_expires_in as SignOptions,
// 	);

// 	return {
// 		user,
// 		patient,
// 		accessToken,
// 		refreshToken,
// 	};

// }

 const verifyEmail = async (payload : IVerifyEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	// ১. বেসিক ইউজার চেকস
	const isUserExist = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExist?.status === "BLOCKED") {
		throw new Error("User is Blocked");
	}

	if (isUserExist?.emailVerified) {
		throw new Error("Email Already Verified");
	}

	if (isUserExist?.isDeleted || isUserExist?.status === "DELETED") {
		throw new Error("User is Deleted");
	}

	// ২. রেডিস থেকে ওটিপি (OTP) ভেরিফিকেশন (Key নাম জেনারেলাইজড করা হলো)
	const otpKey = `user-registration-otp:${email}`;
	const redisOtp = await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new Error("Invalid or Expired OTP");
	}

	if (redisOtp !== otp) {
		throw new Error("OTP Does Not Match");
	}

	// ওটিপি ম্যাচ করলে রেডিস থেকে ডিলিট
	await redisClient.del(otpKey);

	// ৩. রেডিস থেকে পেন্ডিং রেজিস্ট্রেশন ডাটা তুলে আনা
	const userRegistrationKey = `user-registration-data:${email}`;
	const redisUserData = await redisClient.get(userRegistrationKey);

	if(!redisUserData){
		throw new Error("Registration data not found or expired");
	}

	// আপনার নতুন তৈরি করা মিনিমাল ইন্টারফেস অনুযায়ী পার্স করা
	const userPayload : IRegisterUserPayload = JSON.parse(redisUserData);

	// ৪. প্রিজমা ট্রানজেকশন দিয়ে ডাইনামিকলি ইউজার ও তার খালি প্রোফাইল তৈরি (আগের রেজিস্ট্রেশন লজিকের মতো)
	const createdResult = await prisma.$transaction(async (tx) => {
		// ক) মেইন ইউজার তৈরি
		const user = await tx.user.create({
			data: {
				name : userPayload.name,
				email : userPayload.email,
				password: userPayload.password,
				role: userPayload.role, // ডাইনামিক রোল (CUSTOMER / TECHNICIAN ইত্যাদি)
				status: UserStatus.ACTIVE,
				emailVerified: true, // ভেরিফিকেশন সাকসেসফুল
			},
		});

		// খ) রোল অনুযায়ী শুধুমাত্র বেসিক চাইল্ড প্রোফাইল ইনিশিয়ালাইজ করা
		let profileData = null;

		switch (userPayload.role) {
			case Role.CUSTOMER:
				profileData = await tx.customer.create({
					data: {
						userId: user.id,
						accountNumber: `ACC-${Date.now().toString().slice(-6)}`,
            meterNumber: `MTR-${Date.now().toString().slice(-6)}`,
					},
				});
				break;

			case Role.TECHNICIAN:
				profileData = await tx.technician.create({
					data: {
						userId: user.id,
						status: "AVAILABLE",
					},
				});
				break;

			case Role.ZONE_MANAGER:
				profileData = await tx.zoneManager.create({
					data: { userId: user.id },
				});
				break;

			case Role.POWER_OPERATOR:
				profileData = await tx.powerOperator.create({
					data: {
						userId: user.id,
						employeeId: `EMP-${Date.now().toString().slice(-4)}`,
					},
				});
				break;

			default:
				break;
		}

		return { user, profile: profileData };
	});

	// রেডিস থেকে রেজিস্ট্রেশন ডাটা ক্লিন করা
	await redisClient.del(userRegistrationKey);

	// ৫. স্বাগতম ইমেইল পাঠানো (টেমপ্লেটের নাম ও পাথ প্রজেক্টের সাথে সামঞ্জস্যপূর্ণ করা হলো)
	// ⚠️ আপনার ফোল্ডারে এই ejs ফাইলের নাম 'welcome-email.ejs' করে নিতে পারেন
	const templatePath = path.join(process.cwd(), "src/app/templates/welcome-email.ejs");
	
	let html = "";
	try {
		const templateData = { name : createdResult.user.name };
		html = await ejs.renderFile(templatePath, templateData);
	} catch (ejsError) {
		console.log("EJS Render Warning (Proceeding with backup text):", ejsError);
		html = `<h1>Welcome ${createdResult.user.name} to PowerGrid Management System!</h1>`;
	}

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Welcome To Smart Load Shedding & Power Outage Management System",
		html
	});

	// ৬. জেডব্লিউটি (JWT) টোকেন জেনারেশন পার্ট
	const jwtPayload = {
		userId: createdResult.user.id,
		name: createdResult.user.name,
		email: createdResult.user.email,
		role: createdResult.user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	// পাসওয়ার্ড ফিল্ড রেসপন্স থেকে হাইড করার জন্য (নিরাপত্তা)
	const { password: _, ...cleanUser } = createdResult.user;

	return {
		user: cleanUser,
		profile: createdResult.profile, // অটোমেটিকালি যার যার রোল অনুযায়ী প্রোফাইল অবজেক্ট ফেরত যাবে
		accessToken,
		refreshToken,
	};
};


const loginUser = async (payload: ILoginUserPayload) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new Error("User is blocked");
  }

  if (user.isDeleted || user.status === UserStatus.DELETED) {
    throw new Error("User is deleted");
  }

  if(user.password === null && user.googleId !== null){
	throw new Error("Already Has an Account, Please Login With Google Account")
  }

  const isPasswordMatched = await bcrypt.compare(
    password,
    user.password as string,
  );

  if (!isPasswordMatched) {
    throw new Error("Invalid credentials");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

// const getMe = async (user: IRequestUser) => {
//   const isUserExists = await prisma.user.findUnique({
//     where: {
//       id: user.userId,
//     },
//     include: {
//       patient: true,
//     },
//     omit: {
//       password: true,
//     },
//   });

//   if (!isUserExists) {
//     throw new Error("User not found");
//   }

//   return isUserExists;
// };


const getMe = async (user: IRequestUser) => {
  // ১. মেইন ইউজার ডাটাবেসে আছে কিনা চেক করা
  const isUserExists = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },
    // পাসওয়ার্ড ফিল্ড রেসপন্স থেকে হাইড করার জন্য (Prisma v5+)
    omit: {
      password: true,
    },
  });

  if (!isUserExists) {
    throw new Error("User not found");
  }

  // ২. লগইন করা ইউজারের রোল অনুযায়ী সঠিক চাইল্ড প্রোফাইল ডাটাবেস থেকে তুলে আনা
  let profileData = null;

  switch (isUserExists.role) {
    case Role.CUSTOMER:
      profileData = await prisma.customer.findUnique({
        where: { userId: isUserExists.id },
        // আপনি চাইলে কাস্টমার কোন এরিয়াতে আছে তাও একসাথে তুলে নিয়ে আসতে পারেন:
        include: { area: true } 
      });
      break;

    case Role.TECHNICIAN:
      profileData = await prisma.technician.findUnique({
        where: { userId: isUserExists.id },
        // টেকনিশিয়ান কোন জোনে আছে তাও চাইলে ইনক্লুড করতে পারেন:
        include: { zone: true }
      });
      break;

    case Role.ZONE_MANAGER:
      profileData = await prisma.zoneManager.findUnique({
        where: { userId: isUserExists.id },
        include: { zone: true }
      });
      break;

    case Role.POWER_OPERATOR:
      profileData = await prisma.powerOperator.findUnique({
        where: { userId: isUserExists.id },
        include: { substation: true }
      });
      break;

    case Role.ADMIN:
    case Role.SUPER_ADMIN:
      // অ্যাডমিনদের আলাদা কোনো চাইল্ড প্রোফাইল টেবিল নেই
      break;

    default:
      break;
  }

  // ৩. মেইন ইউজারের তথ্যের সাথে তার নির্দিষ্ট প্রোফাইলের তথ্য অবজেক্ট আকারে মার্জ করে রিটার্ন করা
  return {
    ...isUserExists,
    profile: profileData, // এটি ফ্রন্টএন্ডে সরাসরি 'profile' নামে রোল স্পেসিফিক অবজেক্ট দিয়ে দেবে (যেমন কাস্টমার বা টেকনিশিয়ান ডাটা)
  };
};


const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new Error(
      config.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
    throw new Error("User is inactive or not found");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

// const googleLogin = async (payload: IGoogleLogin) => {
//   let googleIdTokenPayload: TokenPayload | null | undefined = null;

//   try {
//     const ticket = await googleClient.verifyIdToken({
//       idToken: payload.idToken,
//       audience: config.google_client_id,
//     });

//     googleIdTokenPayload = ticket.getPayload();
//   } catch (error) {
//     console.log("Google Id Token Verification Failed", error);
//     throw new Error("Invalid or Expired Google Id Token");
//   }

//   if (!googleIdTokenPayload) {
//     throw new Error("Invalid or Expired Google Id Token");
//   }

//   if (!googleIdTokenPayload.name) {
//     throw new Error("Google Email Name Not Found");
//   }

//   if (!googleIdTokenPayload.email) {
//     throw new Error("Google Email Not Found");
//   }

//   const ifPatientExistWithGoogleAuth = await prisma.user.findUnique({
//     where: {
//       email: googleIdTokenPayload.email,
//       role: Role.PATIENT,
//       googleId: googleIdTokenPayload.sub,
//     },
//   });

//   let user = ifPatientExistWithGoogleAuth;

//   if (!ifPatientExistWithGoogleAuth) {
//     const ifPatientExistWithCredentials = await prisma.user.findUnique({
//       where: {
//         email: googleIdTokenPayload.email,
//         role: Role.PATIENT,
//         authProvider: AuthProvider.CREDENTIAL,
//       },
//     });

//     if (ifPatientExistWithCredentials) {
//       if(!ifPatientExistWithCredentials.emailVerified){
// 		throw new Error("Email is Not Verified")
// 	  }		

//       if (ifPatientExistWithCredentials.status === "BLOCKED") {
//         throw new Error("User is Blocked");
//       }

//       if (
//         ifPatientExistWithCredentials.isDeleted ||
//         ifPatientExistWithCredentials.status === UserStatus.DELETED
//       ) {
//         throw new Error("User is Deleted");
//       }

//       user = await prisma.user.update({
//         where: {
//           id: ifPatientExistWithCredentials.id,
//         },
//         data: {
//           googleId: googleIdTokenPayload.sub,
//         },
//       });
//     } else {
//       user = await prisma.user.create({
//         data: {
//           name: googleIdTokenPayload.name,
//           email: googleIdTokenPayload.email,
//           role: Role.PATIENT,
//           googleId: googleIdTokenPayload.sub,
//           authProvider: AuthProvider.GOOGLE,
// 		  emailVerified: true,
//           patient: {
//             create: {
//               name: googleIdTokenPayload.name,
//               email: googleIdTokenPayload.email,
//             },
//           },
//         },
//       });
//     }
//   }

//   if (!user) {
//     throw new Error("User Not Found");
//   }

//   if (user.status === "BLOCKED") {
//     throw new Error("User is Blocked");
//   }

//   if (user.isDeleted || user.status === UserStatus.DELETED) {
//     throw new Error("User is Deleted");
//   }

//   const jwtPayload = {
//     userId: user.id,
//     name: user.name,
//     email: user.email,
//     role: user.role,
//   };

//   const accessToken = jwtUtils.createToken(
//     jwtPayload,
//     config.jwt_access_secret,
//     config.jwt_access_expires_in as SignOptions,
//   );

//   const refreshToken = jwtUtils.createToken(
//     jwtPayload,
//     config.jwt_refresh_secret,
//     config.jwt_refresh_expires_in as SignOptions,
//   );

//   return {
//     accessToken,
//     refreshToken,
//   };
// };


const googleLogin = async (payload: IGoogleLogin) => {
  let googleIdTokenPayload: TokenPayload | null | undefined = null;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_id,
    });

    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.log("Google Id Token Verification Failed", error);
    throw new Error("Invalid or Expired Google Id Token");
  }

  if (!googleIdTokenPayload) {
    throw new Error("Invalid or Expired Google Id Token");
  }

  if (!googleIdTokenPayload.name) {
    throw new Error("Google Email Name Not Found");
  }

  if (!googleIdTokenPayload.email) {
    throw new Error("Google Email Not Found");
  }

  const targetEmail = googleIdTokenPayload.email.trim().toLowerCase();

  // ১. চেক করছি গুগলের এই ইউনিক আইডি এবং ইমেইল দিয়ে অলরেডি কোনো কাস্টমার আছে কিনা
  const ifUserExistWithGoogleAuth = await prisma.user.findUnique({
    where: {
      email: targetEmail,
      role: Role.CUSTOMER, // গুগল দিয়ে মূলত কাস্টমাররাই সাইন-আপ/লগইন করবে
      googleId: googleIdTokenPayload.sub,
    },
  });

  let user = ifUserExistWithGoogleAuth;

  // ২. যদি গুগল দিয়ে আগে অ্যাকাউন্ট না খোলা থাকে, তবে ইমেইল ম্যাচিং চেক করা
  if (!ifUserExistWithGoogleAuth) {
    const ifUserExistWithCredentials = await prisma.user.findUnique({
      where: {
        email: targetEmail,
        role: Role.CUSTOMER,
        authProvider: AuthProvider.CREDENTIAL,
      },
    });

    // ক) যদি নরমাল ইমেইল-পাসওয়ার্ড দিয়ে অলরেডি অ্যাকাউন্ট খোলা থাকে, তবে সেটার সাথে গুগল আইডি লিঙ্ক করা
    if (ifUserExistWithCredentials) {
      if(!ifUserExistWithCredentials.emailVerified){
        throw new Error("Email is Not Verified");
      }		

      if (ifUserExistWithCredentials.status === "BLOCKED") {
        throw new Error("User is Blocked");
      }

      if (
        ifUserExistWithCredentials.isDeleted ||
        ifUserExistWithCredentials.status === UserStatus.DELETED
      ) {
        throw new Error("User is Deleted");
      }

      user = await prisma.user.update({
        where: {
          id: ifUserExistWithCredentials.id,
        },
        data: {
          googleId: googleIdTokenPayload.sub,
        },
      });
    } else {
      // খ) যদি একদমই নতুন ইউজার হয়, তবে গুগল থেকে নাম-ইমেইল নিয়ে অটো-রেজিস্ট্রেশন (উইথ খালি কাস্টমার প্রোফাইল)
      user = await prisma.user.create({
        data: {
          name: googleIdTokenPayload.name,
          email: targetEmail,
          role: Role.CUSTOMER, // ডিফোল্ট রোল কাস্টমার
          googleId: googleIdTokenPayload.sub,
          authProvider: AuthProvider.GOOGLE,
          emailVerified: true, // গুগলের ইমেইল অলরেডি ভেরিফাইড থাকে
          customer: {
            create: {
              accountNumber: `ACC-${Date.now().toString().slice(-6)}`, 
              meterNumber: `MTR-${Date.now().toString().slice(-6)}`,
            },
          },
        },
      });
    }
  }

  // ৩. ফাইনাল সিকিউরিটি ও স্ট্যাটাস চেক
  if (!user) {
    throw new Error("User Not Found");
  }

  if (user.status === "BLOCKED") {
    throw new Error("User is Blocked");
  }

  if (user.isDeleted || user.status === UserStatus.DELETED) {
    throw new Error("User is Deleted");
  }

  // ৪. জেডব্লিউটি (JWT) টোকেন জেনারেশন পার্ট
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};


const forgotPassword = async (payload : IForgotPasswordPayload) => {
	const {email} = payload;

	const isUserExist = await prisma.user.findUnique({
		where : {
			email
		}
	});

	if(!isUserExist){
		throw new Error("User Does Not Exist!")
	};

	if(isUserExist.status === "BLOCKED"){
		throw new Error("User is Blocked")
	}

	if(!isUserExist.emailVerified){
		throw new Error("User Not Verified")
	}

	if(isUserExist.isDeleted || isUserExist.status === "DELETED"){
		throw new Error("User is Deleted")
	}

	if(isUserExist.googleId && isUserExist.authProvider === "GOOGLE"){
		throw new Error("User Has Account With Google")
	}

	const otp = crypto.randomInt(100000, 1000000).toString();

	const key = `forgor-password-otp:${isUserExist.email}`

	const expirationSeconds = 5 * 60

	await redisClient.set(key, otp, {
		expiration : {
			type : "EX",
			value : expirationSeconds
		}
	})

	const tempatePath = path.join(process.cwd(), "src/app/templates/forgot-password.ejs")

	const templateData = {
		name: isUserExist.name,
		otp,
		expirationMinutes: expirationSeconds / 60

	}

	const html = await ejs.renderFile(tempatePath, templateData)

	await transporter.sendMail({
		from : config.email_sender,
		to : isUserExist.email,
		subject : "Forgot Password",
		// text : `Your OTP is ${otp}`
		// html: `<h1>Your OTP is ${otp}</h1>`
		html
	})
}


const resetPassword = async (payload : IResetPasswordPayload) => {
	const { email, otp, newPassword } = payload;

	const isUserExist = await prisma.user.findUnique({
		where: {
			email
		}
	});

	if (!isUserExist) {
		throw new Error("User Does Not Exist!")
	};

	if (isUserExist.status === "BLOCKED") {
		throw new Error("User is Blocked")
	}

	if (!isUserExist.emailVerified) {
		throw new Error("User Not Verified")
	}

	if (isUserExist.isDeleted || isUserExist.status === "DELETED") {
		throw new Error("User is Deleted")
	}

	if (isUserExist.googleId && isUserExist.authProvider === "GOOGLE") {
		throw new Error("User Has Account With Google")
	}

	const key = `forgor-password-otp:${isUserExist.email}`

	const redisOtp = await redisClient.get(key)

	if(!redisOtp){
		throw new Error("Invalid OTP")
	}

	if(redisOtp !== otp){
		throw new Error("OTP Does Not Match")
	}

	const hashedNewPassword = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds));

	await prisma.user.update({
		where : {
			email : isUserExist.email
		},
		data : {
			password : hashedNewPassword
		}
	});

	await redisClient.del([key]);

	const tempatePath = path.join(process.cwd(), "src/app/templates/reset-password-success.ejs")

	const templateData = {
		name: isUserExist.name
	}

	const html = await ejs.renderFile(tempatePath, templateData )


	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExist.email,
		subject: "Password Changed",
		// text : `Your OTP is ${otp}`
		// html: `<h1>Your Password Is Changed</h1>`
		html
	})
}

export const AuthService = {
  registerUser,
  loginUser,
  getMe,
  refreshToken,
  googleLogin,
  forgotPassword,
	resetPassword,
  verifyEmail,
};
