const Order = require("../../models/orderSchema");
const ExcelJS = require("exceljs");
//const PDFDocument = require("pdfkit");
const PDFDocument = require("pdfkit-table");

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
    // Count all orders
    acc.totalOrders++;

    // Calculate original total (before any discounts)
    const originalTotal = order.items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0);
    
    // Add to total sales (original price * quantity)
    acc.totalSales += originalTotal;

    // Calculate actual items subtotal (after product discounts)
    const itemsSubtotal = order.items.reduce((sum, item) => 
      sum + item.subtotal, 0);
    
    // Add to product discount
    acc.productDiscount += originalTotal - itemsSubtotal;

    // Add to coupon discount if applicable
    if (order.coupons) {
      acc.couponDiscount += itemsSubtotal - order.grandTotal;
    }

    // Add to net sales if paid
    if (order.paymentStatus === 'Paid') {
      acc.netSales += order.grandTotal;

      // Calculate refunds for paid orders
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
      orderId: order.orderId,
      orderDate: order.createdAt,
      customerName: order.userId?.name || 'N/A',
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
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
  worksheet.addRow([]);

  // Add order details table
  const orderDetailsHeaders = [
    "Order ID", "Order Date", "Grand Total", "Coupon Discount", "Payment Method",
    "Payment Status", "Product Name", "Quantity", "Original Price",
    "Discounted Price", "Subtotal", "Product Status"
  ];

  worksheet.addRow(orderDetailsHeaders);

  // Add order details data
  stats.orderDetails.forEach(order => {
    order.items.forEach((item, index) => {
      worksheet.addRow([
        index === 0 ? order.orderId : "",
        index === 0 ? new Date(order.orderDate).toLocaleDateString() : "",
        index === 0 ? order.grandTotal : "",
        index === 0 ? order.couponDiscount : "",
        index === 0 ? order.paymentMethod : "",
        index === 0 ? order.paymentStatus : "",
        item.productName,
        item.quantity,
        item.originalPrice,
        item.discountedPrice,
        item.subtotal,
        item.status
      ]);
    });
  });

  // Style the table
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: {style:'thin'},
        left: {style:'thin'},
        bottom: {style:'thin'},
        right: {style:'thin'}
      };
    });
    if (rowNumber === 1 || rowNumber === stats.totalOrders + 11) {
      row.font = { bold: true };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
    }
  });

  // Write Excel file
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=Sales_Report_${dateFilter}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

const generatePDF = (res, stats, dateFilter, start, end) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  doc.pipe(res);

  // Add sales summary at the top
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

  // Prepare table data
  const tableData = {
    headers: [
      "Order ID", "Order Date", "Grand Total", "Coupon Discount", "Payment Method",
      "Payment Status", "Product Name", "Quantity", "Original Price",
      "Discounted Price", "Subtotal", "Product Status"
    ],
    rows: []
  };

  stats.orderDetails.forEach(order => {
    order.items.forEach((item, index) => {
      tableData.rows.push([
        index === 0 ? order.orderId : "",
        index === 0 ? new Date(order.orderDate).toLocaleDateString() : "",
        index === 0 ? `₹${order.grandTotal}` : "",
        index === 0 ? `₹${order.couponDiscount}` : "",
        index === 0 ? order.paymentMethod : "",
        index === 0 ? order.paymentStatus : "",
        item.productName,
        item.quantity,
        `₹${item.originalPrice}`,
        `₹${item.discountedPrice}`,
        `₹${item.subtotal}`,
        item.status
      ]);
    });
  });

  // Draw the table
  doc.table({
    title: "Order Details",
    subtitle: `Date Range: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    headers: tableData.headers,
    rows: tableData.rows,
    columnsSize: [60, 50, 50, 50, 60, 60, 80, 40, 50, 50, 50, 60],
    divider: {
      header: { disabled: false, width: 2, opacity: 1 },
      horizontal: { disabled: false, width: 0.5, opacity: 0.5 },
      vertical: { disabled: false, width: 0.5, opacity: 0.5 }
    },
    padding: 5,
    columnSpacing: 10
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
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Sales_Report_${dateFilter}.pdf`);
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