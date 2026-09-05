import { prisma } from "../../lib/prisma"; // তোমার প্রিসমা ক্লায়েন্ট পাথ
// তোমার কাস্টম জেনারেটেড পাথ থেকে এনামগুলো ইম্পোর্ট করা হলো (কোনো লাল দাগ আসবে না)
import { OutageStatus, OutageType, TechnicianStatus } from "../../../generated/prisma/enums"; 
import { IReportOutagePayload, IOutageResponse } from "./outage.interface";

// ==========================================
// ১. কাস্টমার কমপ্লেন ইঞ্জিন (উইথ অটো-টেকনিশিয়ান অ্যাসাইন)
// ==========================================
const reportUnexpectedOutage = async (payload: any): Promise<any> => {
  const { customerId, areaId, description } = payload;

  // ক) চেক করা—এই এরিয়াতে অলরেডি কোনো লাইভ বিদ্যুৎ বিভ্রাট চলছে কিনা
  const existingActiveOutage = await prisma.outage.findFirst({
    where: {
      areaId,
      type: OutageType.UNEXPECTED,
      status: {
        in: [OutageStatus.PENDING, OutageStatus.ACTIVE, OutageStatus.ASSIGNED, OutageStatus.REPAIRING],
      },
    },
  });

  // যদি অলরেডি বিদ্যুৎ না থাকার রেকর্ড তৈরি হয়ে থাকে, তবে নতুন আউটরেজ না বানিয়ে শুধু কাস্টমারের টিকিট লক করা
  if (existingActiveOutage) {
    const newReport = await prisma.outageReport.create({
      data: {
        customerId,
        description: description || "Reported same outage by another customer.",
        status: OutageStatus.PENDING,
      },
    });

    return {
      message: "This outage is already acknowledged by the system. Your report has been logged.",
      outage: existingActiveOutage,
      report: newReport,
    };
  }

  // খ) একদম নতুন এরর হলে ট্রানজেকশনের মাধ্যমে বিদ্যুৎ বিভ্রাট তৈরি ও টেকনিশিয়ান অটো-এসাইন করা
  return await prisma.$transaction(async (tx) => {
    
    // ১. মেইন এরিয়াতে বিদ্যুৎ নেই (Outage Record) তৈরি করা
    const newOutage = await tx.outage.create({
      data: {
        areaId,
        type: OutageType.UNEXPECTED,
        status: OutageStatus.PENDING,
        reason: "Unexpected Grid/Transformer Breakdown",
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000), // ডিফল্ট ১ ঘণ্টা ধর্তব্য
      },
    });

    // ২. এরিয়ার প্যারেন্ট জোন খুঁজে বের করা (Area -> Feeder -> Substation -> Zone)
    const targetArea = await tx.area.findUnique({
      where: { id: areaId },
      include: {
        feeder: {
          include: {
            substation: {
              select: { zoneId: true }
            }
          }
        }
      }
    });

    const zoneId = targetArea?.feeder?.substation?.zoneId;
    let assignedTechId = null;
    let ticketStatus: OutageStatus = OutageStatus.PENDING;

    if (zoneId) {
      // ৩. ওই জোনের আন্ডারে থাকা প্রথম AVAILABLE টেকনিশিয়ান খুঁজে বের করা
      const availableTech = await tx.technician.findFirst({
        where: { 
          zoneId, 
          status: TechnicianStatus.AVAILABLE 
        },
      });

      if (availableTech) {
        assignedTechId = availableTech.id;
        ticketStatus = OutageStatus.ASSIGNED; // টিকিটের স্ট্যাটাস অ্যাসাইনড হবে

        // ক) টেকনিশিয়ানকে বুক করে ফেলা (ON_DUTY) যেন সে অন্য কাজ না পায়
        await tx.technician.update({
          where: { id: availableTech.id },
          data: { status: TechnicianStatus.ON_DUTY },
        });

        // খ) মেইন আউটরেজ ট্র্যাকিং স্ট্যাটাসও আপডেট করে দেওয়া
        await tx.outage.update({
          where: { id: newOutage.id },
          data: { status: OutageStatus.ASSIGNED },
        });
      }
    }

    // ৪. কাস্টমারের কমপ্লেন টিকিট সরাসরি টেকনিশিয়ানের সাথে ম্যাপ করে তৈরি করা (স্কিমা অনুযায়ী)
    const customerReport = await tx.outageReport.create({
      data: {
        customerId,
        description: description || "Power Outage/Transformer Breakdown Reported.",
        status: ticketStatus,
        technicianId: assignedTechId, // সরাসরি এখানে লিংক বসবে
      },
    });

    // ৫. যদি টেকনিশিয়ান না পাওয়া যায়, তবে আউটরেজকে কিউতে (ACTIVE) পুশ করা
    if (!assignedTechId) {
      await tx.outage.update({
        where: { id: newOutage.id },
        data: { status: OutageStatus.ACTIVE },
      });
    }

    return {
      success: true,
      message: assignedTechId 
        ? "Emergency Outage registered and technician successfully auto-dispatched!" 
        : "Outage registered. No free technician in this zone, queued for manual dispatch.",
      outage: newOutage,
      report: customerReport,
    };
  });
};

// ==========================================
// ২. টেকনিশিয়ান জব ক্লিয়ারেন্স ইঞ্জিন (Restoration Tracking)
// ==========================================
const resolveOutageJob = async (reportId: string): Promise<any> => {
  return await prisma.$transaction(async (tx) => {
    // কমপ্লেন রিপোর্টটি খুঁজে বের করা
    const report = await tx.outageReport.findUnique({
      where: { id: reportId },
      include: { customer: true },
    });

    if (!report) throw new Error("Complaint report ticket not found!");
    if (report.status === OutageStatus.RESTORED) throw new Error("This job is already resolved!");

    // ক) কাস্টমারের টিকিটের স্ট্যাটাস RESTORED করা
    const updatedReport = await tx.outageReport.update({
      where: { id: reportId },
      data: { status: OutageStatus.RESTORED },
    });

    // খ) যদি টিকিটে কোনো টেকনিশিয়ান অ্যাসাইন থাকে, তাকে আবার ফ্রি করে দেওয়া (AVAILABLE)
    if (report.technicianId) {
      await tx.technician.update({
        where: { id: report.technicianId },
        data: { status: TechnicianStatus.AVAILABLE },
      });
    }

    // গ) ওই কাস্টমারের নির্দিষ্ট এরিয়ার চলমান UNEXPECTED আউটরেজগুলো সফলভাবে বন্ধ করা
    const activeOutage = await tx.outage.findFirst({
      where: {
        areaId: report.customer.areaId!,
        type: OutageType.UNEXPECTED,
        status: { in: [OutageStatus.ACTIVE, OutageStatus.ASSIGNED, OutageStatus.REPAIRING] }
      }
    });

    if (activeOutage) {
      await tx.outage.update({
        where: { id: activeOutage.id },
        data: { 
          status: OutageStatus.RESTORED,
          endTime: new Date() // কারেন্ট টাইমস্ট্যাম্প
        },
      });
    }

    return {
      success: true,
      message: "⚡ Power Restored successfully! Grid is online and technician is now free.",
      report: updatedReport
    };
  });
};

// ==========================================
// ৩. লাইভ স্ট্যাটাস ইঞ্জিন (কাস্টমার ড্যাশবোর্ডে অটো শো করার জন্য)
// ==========================================
const getActiveOutageByArea = async (areaId: string) => {
  const result = await prisma.outage.findFirst({
    where: {
      areaId,
      status: {
        in: [OutageStatus.PLANNED, OutageStatus.ACTIVE, OutageStatus.ASSIGNED, OutageStatus.REPAIRING],
      },
    },
    include: {
      area: {
        select: {
          name: true,
          priority: true
        }
      }
    }
  });

  return result;
};




const assignTechnicianManually = async (reportId: string, technicianId: string) => {
  return await prisma.$transaction(async (tx) => {
    
    // ১. চেক করা—টেকনিশিয়ানটি আসলেই সিস্টেমে আছে এবং AVAILABLE কি না
    const technician = await tx.technician.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      throw new Error("Selected Technician profile not found!");
    }

    if (technician.status !== TechnicianStatus.AVAILABLE) {
      throw new Error("This technician is currently ON_DUTY or OFFLINE. Cannot assign!");
    }

    // ২. কাস্টমারের কমপ্লেন রিপোর্টের স্ট্যাটাস ASSIGNED করা এবং টেকনিশিয়ান আইডি লিঙ্ক করা
    const updatedReport = await tx.outageReport.update({
      where: { id: reportId },
      data: {
        status: OutageStatus.ASSIGNED,
        technicianId: technicianId,
      },
    });

    // ৩. টেকনিশিয়ানকে সাথে সাথে বুক করে ফেলা (ON_DUTY) যেন সে অন্য কোনো কাজ না পায়
    await tx.technician.update({
      where: { id: technicianId },
      data: { status: TechnicianStatus.ON_DUTY },
    });

    return updatedReport;
  });
};

export const OutageService = {
  reportUnexpectedOutage,
  resolveOutageJob,
  getActiveOutageByArea,
  assignTechnicianManually,
};
