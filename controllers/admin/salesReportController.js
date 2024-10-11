const Order = require("../../models/orderSchema");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

// Helper function for calculations
const calculateStats = async (startDate, endDate) => {
  const orders = await Order.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    }
  }).populate('userId', 'name')
    .populate('items.productId', 'name');

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

    // Add order details to the accumulator
    acc.orderDetails.push({
      orderId: order._id,
      orderDate: order.createdAt,
      customerName: order.userId?.name || 'N/A',
      paymentStatus: order.paymentStatus,
      originalTotal,
      productDiscount: originalTotal - itemsSubtotal,
      couponDiscount: order.coupons ? (itemsSubtotal - order.grandTotal) : 0,
      grandTotal: order.grandTotal,
      items: order.items.map(item => ({
        productName: item.productId?.name || 'N/A',
        quantity: item.quantity,
        originalPrice: item.price,
        discountedPrice: item.subtotal / item.quantity,
        subtotal: item.subtotal,
        status: item.deliveryStatus
      }))
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

  // Calculate remaining metrics
  stats.netBeforeCoupons = stats.totalSales - stats.productDiscount;
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

// Filter results
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

const generateExcel = async (res, stats, dateFilter, start, end) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sales Report");

  // Define columns for overall sales data
  worksheet.columns = [
    { header: "Metrics", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 30 },
  ];

  // Add overall summary at the top
  worksheet.addRow({ metric: "Total Orders", value: stats.totalOrders });
  worksheet.addRow({ metric: "Total Sales (Before Discounts)", value: `₹${stats.totalSales}` });
  worksheet.addRow({ metric: "Product Discount", value: `₹${stats.productDiscount}` });
  worksheet.addRow({ metric: "Net Before Coupons", value: `₹${stats.netBeforeCoupons}` });
  worksheet.addRow({ metric: "Coupon Discount", value: `₹${stats.couponDiscount}` });
  worksheet.addRow({ metric: "Net Sales", value: `₹${stats.netSales}` });
  worksheet.addRow({ metric: "Refund Amount", value: `₹${stats.refundAmount}` });
  worksheet.addRow({ metric: "Net Sales After Refunds", value: `₹${stats.netSalesAfterRefunds}` });

  // Add some space between summary and order details
  worksheet.addRow([]);

  // Define columns for order details and product details
  worksheet.columns = [
    { header: "Sl No", key: "slNo", width: 10 },
    { header: "Order ID", key: "orderId", width: 20 },
    { header: "Order Date", key: "orderDate", width: 20 },
    { header: "Payment Status", key: "paymentStatus", width: 20 },
    { header: "Original Total", key: "originalTotal", width: 20 },
    { header: "Product Discount", key: "productDiscount", width: 20 },
    { header: "Coupon Discount", key: "couponDiscount", width: 20 },
    { header: "Grand Total", key: "grandTotal", width: 20 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Quantity", key: "quantity", width: 15 },
    { header: "Original Price", key: "originalPrice", width: 15 },
    { header: "Discounted Price", key: "discountedPrice", width: 15 },
    { header: "Subtotal", key: "subtotal", width: 15 },
    { header: "Product Status", key: "productStatus", width: 20 },
  ];

  // Start serial number counter
  let slNo = 1;

  // Iterate through the orders and products
  stats.orderDetails.forEach(order => {
    // Add common order details row (shown once for each order)
    worksheet.addRow({
      slNo: slNo++,  // Increment the serial number for each order
      orderId: order._id,  // Use ObjectId instead of orderId
      orderDate: new Date(order.orderDate).toLocaleDateString(),
      paymentStatus: order.paymentStatus,
      originalTotal: `₹${order.originalTotal}`,
      productDiscount: `₹${order.productDiscount}`,
      couponDiscount: `₹${order.couponDiscount}`,
      grandTotal: `₹${order.grandTotal}`,
    });

    // Add subrows for each product within the order
    order.items.forEach(item => {
      worksheet.addRow({
        productName: item.productName,
        quantity: item.quantity,
        originalPrice: `₹${item.originalPrice}`,
        discountedPrice: `₹${item.discountedPrice}`,
        subtotal: `₹${item.subtotal}`,
        productStatus: item.status,
      });
    });

    // Add a blank row after each order for separation
    worksheet.addRow([]);
  });

  // Write Excel file
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=Sales_Report_${dateFilter}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};


// Generate PDF report
const generatePDF = (res, stats, dateFilter, start, end) => {
  const doc = new PDFDocument();
  doc.pipe(res);

  // Add sales summary at the top
  doc.fontSize(14).text("Sales Summary:");
  doc.fontSize(12).text(`Total Orders: ${stats.totalOrders}`);
  doc.text(`Total Sales (Before Discounts): ₹${stats.totalSales}`);
  doc.text(`Product Discount: ₹${stats.productDiscount}`);
  doc.text(`Net Before Coupons: ₹${stats.netBeforeCoupons}`);
  doc.text(`Coupon Discount: ₹${stats.couponDiscount}`);
  doc.text(`Net Sales: ₹${stats.netSales}`);
  doc.text(`Refund Amount: ₹${stats.refundAmount}`);
  doc.text(`Net Sales After Refunds: ₹${stats.netSalesAfterRefunds}`);
  doc.moveDown();

  // Create a table for order details
  doc.fontSize(14).text("Order Details:");
  const tableHeaders = ["Order ID", "Order Date", "Customer Name", "Payment Status", "Original Total", "Product Discount", "Coupon Discount", "Grand Total", "Product Name", "Quantity", "Original Price", "Discounted Price", "Subtotal", "Product Status"];
  
  // Draw table headers
  tableHeaders.forEach(header => {
    doc.fontSize(10).text(header, { continued: true });
    doc.text("   ", { continued: true });  // Add space between columns
  });
  doc.moveDown();

  // Add order details in tabular form with product details as subrows
  stats.orderDetails.forEach(order => {
    order.items.forEach((item, idx) => {
      doc.fontSize(10).text(order.orderId, { continued: true });
      doc.text(new Date(order.orderDate).toLocaleDateString(), { continued: true });
      doc.text(order.customerName, { continued: true });
      doc.text(order.paymentStatus, { continued: true });
      doc.text(`₹${order.originalTotal}`, { continued: true });
      doc.text(`₹${order.productDiscount}`, { continued: true });
      doc.text(`₹${order.couponDiscount}`, { continued: true });
      doc.text(`₹${order.grandTotal}`, { continued: true });
      doc.text(item.productName, { continued: true });
      doc.text(item.quantity, { continued: true });
      doc.text(`₹${item.originalPrice}`, { continued: true });
      doc.text(`₹${item.discountedPrice}`, { continued: true });
      doc.text(`₹${item.subtotal}`, { continued: true });
      doc.text(item.status);

      // Move to the next line for the next product in the same order
      doc.moveDown();
    });
    doc.moveDown();
  });

  doc.end();
};
// Download report handler
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