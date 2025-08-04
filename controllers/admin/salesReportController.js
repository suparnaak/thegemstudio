const Order = require("../../models/orderSchema");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit-table");

//for calculations
const calculateStats = async (startDate, endDate) => {
  const orders = await Order.find({
    createdAt: { $gte: startDate, $lte: endDate }
  })
    .populate("userId", "name")
    .populate("items.productId", "name");

  const stats = orders.reduce((acc, order) => {
    acc.totalOrders++;

    const allOriginalTotal = order.items.reduce(
      (sum, item) => sum + item.price * item.quantity, 0
    );
    const allDiscountedTotal = order.items.reduce(
      (sum, item) => sum + item.subtotal, 0
    );
    acc.totalSales += allOriginalTotal;
    acc.productDiscount += (allOriginalTotal - allDiscountedTotal);

    let totalCouponDiscount = 0;
    if (order.coupons && allDiscountedTotal > 0) {
      totalCouponDiscount = allDiscountedTotal - order.grandTotal;
      acc.couponDiscount += totalCouponDiscount;
    }

    const itemsWithCoupon = order.items.map(item => {
      const itemDiscTotal = item.subtotal;
      const couponShare = order.coupons && allDiscountedTotal > 0
        ? ((itemDiscTotal / allDiscountedTotal) * totalCouponDiscount).toFixed(2)
        : "0.00";
      const subtotalAfterCoupon = (itemDiscTotal - couponShare).toFixed(2);
      return {
        productName:     item.productId?.name || "N/A",
        quantity:        item.quantity,
        originalPrice:   item.price,
        discountedPrice: (item.subtotal / item.quantity).toFixed(2),
        couponShare:     couponShare,
        subtotal:        subtotalAfterCoupon,
        status:          item.deliveryStatus
      };
    });

    if (order.paymentStatus === "Paid") {
      acc.netSales += order.grandTotal;

      const toRefund = itemsWithCoupon.filter(it =>
        ["Returned","Cancelled","Admin Cancelled"].includes(it.status)
      );
      if (toRefund.length) {
        const refundSum = toRefund.reduce(
          (sum, it) => sum + parseFloat(it.subtotal), 0
        );
        acc.refundAmount += refundSum;
      }
    }

    acc.orderDetails.push({
      orderId:        order.orderId,
      orderDate:      order.createdAt,
      paymentMethod:  order.paymentMethod,
      paymentStatus:  order.paymentStatus,
      originalTotal:  allOriginalTotal,
      productDiscount:      (allOriginalTotal - allDiscountedTotal),
      couponDiscount:       totalCouponDiscount,
      grandTotal:           order.grandTotal,
      items:                itemsWithCoupon
    });

    return acc;
  }, {
    totalOrders: 0,
    totalSales: 0,
    productDiscount: 0,
    couponDiscount: 0,
    netSales: 0,
    refundAmount: 0,
    orderDetails: []
  });

  stats.netBeforeCoupons     = stats.totalSales - stats.productDiscount;
  stats.netSalesAfterRefunds = stats.netSales - stats.refundAmount;
  return stats;
};



// Load sales report page
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
    const renderData = {
      ...stats,
      dateRange: dateFilter,
    };
    if (dateFilter === "custom") {
      renderData.startDate = startDate;
      renderData.endDate = endDate;
    }
    res.render("sales-report", renderData);
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
const generateExcel = async (res, stats, dateFilter, start, end) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sales Report");

  ws.columns = [
    { header: "Metrics", key: "metric", width: 30 },
    { header: "Value",   key: "value",  width: 20 }
  ];
  ws.addRow({ metric: "Total Orders",               value: stats.totalOrders });
  ws.addRow({ metric: "Total Sales (Before Discounts)", value: `₹${stats.totalSales}` });
  ws.addRow({ metric: "Product Discount",           value: `₹${stats.productDiscount}` });
  ws.addRow({ metric: "Net Before Coupons",         value: `₹${stats.netBeforeCoupons}` });
  ws.addRow({ metric: "Coupon Discount",            value: `₹${stats.couponDiscount}` });
  ws.addRow({ metric: "Net Sales",                  value: `₹${stats.netSales}` });
  ws.addRow({ metric: "Refund Amount",              value: `₹${stats.refundAmount}` });
  ws.addRow({ metric: "Net Sales After Refunds",    value: `₹${stats.netSalesAfterRefunds}` });

  ws.addRow([]);
  ws.addRow([]);

  ws.addRow([
    "Order ID", "Order Date", "Payment Method", "Payment Status",
    "Product Name", "Qty", "Original Price", "Discounted Price",
    "Coupon Share", "Subtotal", "Product Status"
  ]).font = { bold: true };

  stats.orderDetails.forEach(order => {
    order.items.forEach((it, i) => {
      ws.addRow([
        i === 0 ? order.orderId : "",
        i === 0 ? new Date(order.orderDate).toLocaleDateString() : "",
        i === 0 ? order.paymentMethod : "",
        i === 0 ? order.paymentStatus : "",
        it.productName,
        it.quantity,
        `₹${it.originalPrice}`,
        `₹${it.discountedPrice}`,
        `₹${it.couponShare}`,
        `₹${it.subtotal}`,
        it.status
      ]);
    });
  });

  ws.eachRow(r => r.eachCell(c => {
    c.border = {
      top: { style: "thin" }, left: { style: "thin" },
      bottom: { style: "thin" }, right: { style: "thin" }
    };
  }));

  res.setHeader("Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition",
    `attachment; filename=Sales_Report_${dateFilter}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
};

const generatePDF = (res, stats, dateFilter, start, end) => {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
  doc.pipe(res);

  doc.fontSize(14).text("Sales Summary:", { underline: true });
  doc.fontSize(10);
  doc.text(`Total Orders: ${stats.totalOrders}`);
  doc.text(`Total Sales (Before Discounts): ₹${stats.totalSales}`);
  doc.text(`Product Discount: ₹${stats.productDiscount}`);
  doc.text(`Net Before Coupons: ₹${stats.netBeforeCoupons}`);
  doc.text(`Coupon Discount: ₹${stats.couponDiscount}`);
  doc.text(`Net Sales: ₹${stats.netSales}`);
  doc.text(`Refund Amount: ₹${stats.refundAmount}`);
  doc.text(`Net Sales After Refunds: ₹${stats.netSalesAfterRefunds}`);
  doc.moveDown();

  const headers = [
    "Order ID", "Order Date", "Payment Method", "Payment Status",
    "Product Name", "Qty", "Original Price", "Discounted Price",
    "Coupon Share", "Subtotal", "Product Status"
  ];
  const rows = [];
  stats.orderDetails.forEach(order => {
    order.items.forEach((it, i) => {
      rows.push([
        i === 0 ? order.orderId : "",
        i === 0 ? new Date(order.orderDate).toLocaleDateString() : "",
        i === 0 ? order.paymentMethod : "",
        i === 0 ? order.paymentStatus : "",
        it.productName,
        it.quantity,
        `₹${it.originalPrice}`,
        `₹${it.discountedPrice}`,
        `₹${it.couponShare}`,
        `₹${it.subtotal}`,
        it.status
      ]);
    });
  });

  doc.table({
    title:    `Order Details (${start.toLocaleDateString()} – ${end.toLocaleDateString()})`,
    headers,
    rows,
    columnSpacing: 8,
    padding: 5
  });

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

    if (format === "excel") {
      await generateExcel(res, stats, dateFilter, start, end);
    } else if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Sales_Report_${dateFilter}.pdf`
      );
      generatePDF(res, stats, dateFilter, start, end);
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
