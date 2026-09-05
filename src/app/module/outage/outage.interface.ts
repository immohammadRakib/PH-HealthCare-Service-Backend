export interface IReportOutagePayload {
  customerId: string;
  areaId: string;
  description?: string;
}

// ⚡ ১. টেকনিশিয়ান জব ক্লিয়ার করার জন্য আমরা reportId পাস করছি, তাই ইন্টারফেসটি এমন হবে
export interface IResolveJobPayload {
  reportId: string; // 👈 এটি যুক্ত করা বাধ্যতামূলক, কারণ কোন টিকিটটি ফিক্স হলো তা ট্র্যাক করতে হবে
  notes?: string;
}

// ⚡ ২. স্কিমা এবং আপডেটেড সার্ভিসের রিটার্ন অবজেক্ট অনুযায়ী রেসপন্স টাইপ ফিক্স করা হলো
export interface IOutageResponse {
  success: boolean;   // 👈 আমাদের স্ট্যান্ডার্ড রেসপন্সের জন্য এটি যোগ করা ভালো
  message: string;
  outage?: any;        // 👈 অপশনাল করা হলো কারণ জব রিসলভ করার সময় এটি অনেক সময় মেইন অবজেক্টে থাকে না
  report?: any;
  assignedTechnicianId?: string;
  // 'assignment' ফিল্ডটি বাদ দেওয়া হয়েছে কারণ আমাদের স্কিমাতে OutageAssignment নামে কোনো এক্সট্রা টেবিল নেই
}
