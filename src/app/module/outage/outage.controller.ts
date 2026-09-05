import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { OutageService } from "./outage.service";

// ১. কাস্টমার কমপ্লেন টিকিট ক্রিয়েশন কন্ট্রোলার
const reportUnexpectedOutage = catchAsync(async (req: Request, res: Response) => {
  const loginUser = (req as any).user; // JWT মিডলওয়্যার থেকে আসা লগইনড ইউজার
  
  // কাস্টমার রেজিস্ট্রেশনের সময় আমরা তার প্রোফাইল ডাইনামিকালি ম্যাপ করেছি। 
  // যদি তোমার Auth মিডলওয়্যার সরাসরি কাস্টমারের profileId বা areaId না দেয়, 
  // তবে পোস্টম্যানের বডি (req.body) থেকে পাঠানো ডাটা এখানে নিখুঁতভাবে রিসিভ হবে।
  const payload = {
    customerId: req.body.customerId || loginUser?.profileId, 
    areaId: req.body.areaId || loginUser?.areaId,
    description: req.body.description,
  };

  if (!payload.customerId || !payload.areaId) {
    throw new Error("customerId and areaId are mandatory to report an outage!");
  }

  const result = await OutageService.reportUnexpectedOutage(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.message,
    data: result,
  });
});

// ২. টেকনিশিয়ান জব ক্লিয়ারেন্স / বিদ্যুৎ সচল করার কন্ট্রোলার
const resolveOutageJob = catchAsync(async (req: Request, res: Response) => {
  // ⚡ assignmentId পরিবর্তন করে reportId (টিকিট আইডি) করা হলো
  const { reportId } = req.params; 

  // আমাদের আপডেটেড সার্ভিস লজিক অনুযায়ী আমরা সরাসরি reportId পাস করছি
  const result = await OutageService.resolveOutageJob(reportId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

// ৩. লাইভ স্ট্যাটাস ইঞ্জিন (ড্যাশবোর্ডের জন্য)
const getMyAreaLiveStatus = catchAsync(async (req: Request, res: Response) => {
  const loginUser = (req as any).user;
  const areaId = req.query.areaId || loginUser?.areaId;

  if (!areaId) {
    throw new Error("areaId query parameter is required!");
  }

  const result = await OutageService.getActiveOutageByArea(areaId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result ? "Active outage detected in your area." : "⚡ Grid is healthy.",
    data: result || { status: "HEALTHY", message: "Power is active and stable." },
  });
});


const assignTechnicianManually = catchAsync(async (req: Request, res: Response) => {
  const { reportId, technicianId } = req.body;

  if (!reportId || !technicianId) {
    throw new Error("reportId and technicianId are required in request body!");
  }

  const result = await OutageService.assignTechnicianManually(reportId, technicianId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Technician has been successfully assigned to the outage ticket manually.",
    data: result,
  });
});


export const OutageController = {
  reportUnexpectedOutage,
  resolveOutageJob,
  getMyAreaLiveStatus,
  assignTechnicianManually
};
