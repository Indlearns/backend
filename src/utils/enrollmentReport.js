/** Group enrollment rows by YYYY-MM month key */
export const groupByMonth = (rows, dateField = "enrolledAt") => {
  const groups = {};
  for (const row of rows) {
    const d = new Date(row[dateField]);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!groups[key]) {
      groups[key] = {
        month: key,
        label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        enrollments: [],
      };
    }
    groups[key].enrollments.push(row);
  }
  return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month));
};

export const formatEnrollmentRow = (purchase, course) => {
  const student = purchase.student;
  return {
    studentId: student?._id,
    name: student?.name || "",
    email: student?.email || "",
    phone: student?.phone || "",
    courseId: course?._id || purchase.course,
    courseTitle: course?.title || "",
    amount: purchase.amount ?? 0,
    currency: purchase.currency || "INR",
    paymentId: purchase.razorpayPaymentId || "",
    orderId: purchase.razorpayOrderId || "",
    enrolledAt: purchase.createdAt,
    source: purchase.amount > 0 ? "razorpay" : "free",
  };
};

export const enrollmentsToCsv = (rows) => {
  const headers = [
    "Student Name",
    "Email",
    "Phone",
    "Course",
    "Amount",
    "Currency",
    "Payment Type",
    "Razorpay Payment ID",
    "Razorpay Order ID",
    "Enrolled Date",
    "Month",
  ];

  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = rows.map((r) => {
    const d = new Date(r.enrolledAt);
    const month = Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const dateStr = Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    return [
      r.name,
      r.email,
      r.phone,
      r.courseTitle,
      r.amount,
      r.currency,
      r.source,
      r.paymentId,
      r.orderId,
      dateStr,
      month,
    ]
      .map(escape)
      .join(",");
  });

  return [headers.join(","), ...lines].join("\n");
};
