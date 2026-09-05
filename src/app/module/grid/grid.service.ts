import { prisma } from '../../lib/prisma';

// ১. পাওয়ার অথরিটি তৈরি (e.g., DESCO, DPDC)
const createPowerAuthorityInDB = async (payload: any) => {
  return await prisma.powerAuthority.create({ data: payload });
};

// ২. ডিস্ট্রিবিউশন জোন তৈরি (e.g., Dhaka North, Sylhet Zone)
const createZoneInDB = async (payload: any) => {
  return await prisma.distributionZone.create({ data: payload });
};

// ৩. উপকেন্দ্র বা সাবস্টেশন তৈরি
const createSubstationInDB = async (payload: any) => {
  return await prisma.substation.create({ data: payload });
};

// ৪. ফিডার লাইন তৈরি
const createFeederInDB = async (payload: any) => {
  return await prisma.feeder.create({ data: payload });
};

// ৫. চূড়ান্ত এরিয়া/এলাকা তৈরি (যা কাস্টমার প্রোফাইলে লাগবে)
const createAreaInDB = async (payload: any) => {
  return await prisma.area.create({ data: payload });
};

export const GridServices = {
  createPowerAuthorityInDB,
  createZoneInDB,
  createSubstationInDB,
  createFeederInDB,
  createAreaInDB,
};
