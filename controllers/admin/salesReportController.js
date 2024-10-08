const Order = require("../../models/orderSchema");
const Excel = require("exceljs");
const PDFDocument = require("pdfkit");

// Helper function for calculations
const calculateStats = async (startDate, endDate) => {
  const orders = await Order.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    }
  });

  const stats = orders.reduce((acc, order) => {
    // 1. Count all orders
    acc.totalOrders++;

    // Calculate original total (before any discounts)
    const originalTotal = order.items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0);
    
    // 2. Add to total sales (original price * quantity)
    acc.totalSales += originalTotal;

    // Calculate actual items subtotal (after product discounts)
    const itemsSubtotal = order.items.reduce((sum, item) => 
      sum + item.subtotal, 0);
    
    // 3. Add to product discount
    acc.productDiscount += originalTotal - itemsSubtotal;

    // 4. Add to coupon discount if applicable
    if (order.coupons) {
      acc.couponDiscount += itemsSubtotal - order.grandTotal;
    }

    // 5. Add to net sales if paid
    if (order.paymentStatus === 'Paid') {
      acc.netSales += order.grandTotal;

      // 6. Calculate refunds for paid orders
      const refundEligibleItems = order.items.filter(item => 
        ['Returned', 'Cancelled', 'Admin Cancelled'].includes(item.deliveryStatus)
      );
      
      if (refundEligibleItems.length > 0) {
        const refundAmount = refundEligibleItems.reduce((sum, item) => 
          sum + item.subtotal, 0);
        acc.refundAmount += refundAmount;
      }
    }

    return acc;
  }, {
    totalOrders: 0,
    totalSales: 0,
    productDiscount: 0,
    couponDiscount: 0,
    netSales: 0,
    refundAmount: 0
  });

  // Calculate remaining metrics
  stats.netBeforeCoupons = stats.totalSales - stats.productDiscount;
  stats.netSalesAfterRefunds = stats.netSales - stats.refundAmount;

  return stats;
};

//load sales report page
const getSalesReport = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const stats = await calculateStats(startOfDay, endOfDay);

    res.render("sales-report", {
      ...stats,
      dateRange: "daily",
    });
  } catch (error) {
    console.error("Error in getSalesReport:", error);
    res.status(500).redirect("/admin/error");
  }
};

//filter results
const filterSalesReport = async (req, res) => {
  try {
    const { dateFilter, startDate, endDate } = req.body;
    const today = new Date();
    let start, end;

    switch (dateFilter) {
      case "daily":
        start = new Date(today.setHours(0, 0, 0, 0));
        end = new Date(today.setHours(23, 59, 59, 999));
        break;
      case "weekly":
        start = new Date(today.setDate(today.getDate() - 7));
        end = new Date(new Date().setHours(23, 59, 59, 999));
        break;
      case "monthly":
        start = new Date(today.setMonth(today.getMonth() - 1));
        end = new Date(new Date().setHours(23, 59, 59, 999));
        break;
      case "yearly":
        start = new Date(today.setFullYear(today.getFullYear() - 1));
        end = new Date(new Date().setHours(23, 59, 59, 999));
        break;
      case "custom":
        if (!startDate || !endDate) {
          throw new Error("Start and end dates are required for custom range");
        }
        start = new Date(startDate);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        throw new Error("Invalid date filter");
    }

    const stats = await calculateStats(start, end);

    res.render("sales-report", {
      ...stats,
      dateRange: dateFilter,
    });
  } catch (error) {
    console.error("Error in filterSalesReport:", error);
    res.status(400).render("sales-report", {
      error: error.message,
      totalOrders: 0,
      totalSales: 0,
      productDiscount: 0,
      couponDiscount: 0,
      netSales: 0,
      refundAmount: 0,
      netBeforeCoupons: 0,
      netSalesAfterRefunds: 0,
      dateRange: "daily",
    });
  }
};

//download reports
const generateExcel = async (res, stats, dateFilter, startDate, endDate) => {
  const workbook = new Excel.Workbook();
  const worksheet = workbook.addWorksheet("Sales Report");

  worksheet.addRow(["Sales Report"]);
  worksheet.addRow([
    "Date Range:",
    `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
  ]);
  worksheet.addRow([""]);

  worksheet.addRow(["Sales Summary"]);
  worksheet.addRow(["Metric", "Value"]);
  worksheet.addRow(["Total Orders", stats.totalOrders]);
  worksheet.addRow(["Total Sales(Before Discounts)", `₹${stats.totalSales}`]);
  worksheet.addRow(["Product Discount", `₹${stats.productDiscount}`]);
  worksheet.addRow(["Net Before Coupons", `₹${stats.netBeforeCoupons}`]);
  worksheet.addRow(["Coupon Discount", `₹${stats.couponDiscount}`]);
  worksheet.addRow(["Net Sales", `₹${stats.netSales}`]);
  worksheet.addRow(["Refund Amount", `₹${stats.refundAmount}`]);
  worksheet.addRow(["Net Sales After Refunds", `₹${stats.netSalesAfterRefunds}`]);

  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(2).width = 15;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=sales-report-${dateFilter}.xlsx`
  );

  await workbook.xlsx.write(res);
};

const generatePDF = async (res, stats, dateFilter, startDate, endDate) => {
  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=sales-report-${dateFilter}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(16).text("Sales Report", { align: "center" });
  doc
    .fontSize(12)
    .text(
      `Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      { align: "center" }
    );
  doc.moveDown();

  doc.fontSize(14).text("Sales Summary");
  doc.fontSize(12);
  doc.text(`Total Orders: ${stats.totalOrders}`);
  doc.text(`Total Sales(Before Discount): ₹${stats.totalSales}`);
  doc.text(`Product Discount: ₹${stats.productDiscount}`);
  doc.text(`Net Before Coupons: ₹${stats.netBeforeCoupons}`);
  doc.text(`Coupon Discount: ₹${stats.couponDiscount}`);
  doc.text(`Net Sales: ₹${stats.netSales}`);
  doc.text(`Refund Amount: ₹${stats.refundAmount}`);
  doc.text(`Net Sales After Refunds: ₹${stats.netSalesAfterRefunds}`);

  doc.end();
};

const downloadReport = async (req, res) => {
  try {
    const { format, dateFilter, startDate, endDate } = req.body;
    const today = new Date();
    let start, end;

    switch (dateFilter) {
      case "daily":
        start = new Date(today.setHours(0, 0, 0, 0));
        end = new Date(today.setHours(23, 59, 59, 999));
        break;
      case "weekly":
        start = new Date(today.setDate(today.getDate() - 7));
        end = new Date(new Date().setHours(23, 59, 59, 999));
        break;
      case "monthly":
        start = new Date(today.setMonth(today.getMonth() - 1));
        end = new Date(new Date().setHours(23, 59, 59, 999));
        break;
      case "yearly":
        start = new Date(today.setFullYear(today.getFullYear() - 1));
        end = new Date(new Date().setHours(23, 59, 59, 999));
        break;
      case "custom":
        start = new Date(startDate);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        throw new Error("Invalid date filter");
    }

    const stats = await calculateStats(start, end);

    if (format === "excel") {
      await generateExcel(res, stats, dateFilter, start, end);
    } else if (format === "pdf") {
      await generatePDF(res, stats, dateFilter, start, end);
    } else {
      throw new Error("Invalid format specified");
    }
  } catch (error) {
    console.error("Error in downloadReport:", error);
    res.status(500).send("Error generating report");
  }
};

module.exports = {
  getSalesReport,
  filterSalesReport,
  downloadReport,
};