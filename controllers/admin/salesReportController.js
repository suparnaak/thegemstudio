const Order = require("../../models/orderSchema");
const Excel = require('exceljs');
const PDFDocument = require('pdfkit');
const getSalesReport = async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        const stats = await calculateStats(startOfDay, endOfDay);
        
        res.render("sales-report", {
            ...stats,
            dateRange: 'daily'
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
            case 'daily':
                start = new Date(today.setHours(0, 0, 0, 0));
                end = new Date(today.setHours(23, 59, 59, 999));
                break;
            case 'weekly':
                start = new Date(today.setDate(today.getDate() - 7));
                end = new Date(new Date().setHours(23, 59, 59, 999));
                break;
            case 'monthly':
                start = new Date(today.setMonth(today.getMonth() - 1));
                end = new Date(new Date().setHours(23, 59, 59, 999));
                break;
            case 'yearly':
                start = new Date(today.setFullYear(today.getFullYear() - 1));
                end = new Date(new Date().setHours(23, 59, 59, 999));
                break;
            case 'custom':
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
            dateRange: dateFilter
        });
    } catch (error) {
        console.error("Error in filterSalesReport:", error);
        res.status(400).render("admin/sales-report", {
            error: error.message,
            totalOrders: 0,
            totalSales: 0,
            totalDiscount: 0,
            dateRange: 'daily'
        });
    }
};

// Helper function to calculate stats
const calculateStats = async (startDate, endDate) => {
    const orders = await Order.find({
        createdAt: { 
            $gte: startDate, 
            $lte: endDate 
        }
    });

    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + order.grandTotal, 0);
    const totalDiscount = orders.reduce((sum, order) => {
        const orderDiscount = order.items.reduce((itemSum, item) => 
            itemSum + (item.price * item.quantity), 0) - order.grandTotal;
        return sum + orderDiscount;
    }, 0);

    return { totalOrders, totalSales, totalDiscount };
};
const downloadReport = async (req, res) => {
    try {
        const { format, dateFilter, startDate, endDate } = req.body;
        const today = new Date();
        let start, end;

        // Determine date range
        switch (dateFilter) {
            case 'daily':
                start = new Date(today.setHours(0, 0, 0, 0));
                end = new Date(today.setHours(23, 59, 59, 999));
                break;
            case 'weekly':
                start = new Date(today.setDate(today.getDate() - 7));
                end = new Date(new Date().setHours(23, 59, 59, 999));
                break;
            case 'monthly':
                start = new Date(today.setMonth(today.getMonth() - 1));
                end = new Date(new Date().setHours(23, 59, 59, 999));
                break;
            case 'yearly':
                start = new Date(today.setFullYear(today.getFullYear() - 1));
                end = new Date(new Date().setHours(23, 59, 59, 999));
                break;
            case 'custom':
                start = new Date(startDate);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                throw new Error("Invalid date filter");
        }

        // Calculate stats
        const stats = await calculateStats(start, end);

        if (format === 'excel') {
            await generateExcel(res, stats, dateFilter, start, end);
        } else if (format === 'pdf') {
            await generatePDF(res, stats, dateFilter, start, end);
        } else {
            throw new Error("Invalid format specified");
        }

    } catch (error) {
        console.error("Error in downloadReport:", error);
        res.status(500).send("Error generating report");
    }
};

const generateExcel = async (res, stats, dateFilter, startDate, endDate) => {
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add title and date range
    worksheet.addRow(['Sales Report']);
    worksheet.addRow(['Date Range:', `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`]);
    worksheet.addRow(['']);

    // Add summary
    worksheet.addRow(['Sales Summary']);
    worksheet.addRow(['Metric', 'Value']);
    worksheet.addRow(['Total Orders', stats.totalOrders]);
    worksheet.addRow(['Total Sales', `₹${stats.totalSales}`]);
    worksheet.addRow(['Total Discount', `₹${stats.totalDiscount}`]);

    // Set column widths
    worksheet.getColumn(1).width = 15;
    worksheet.getColumn(2).width = 15;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${dateFilter}.xlsx`);

    // Write to response
    await workbook.xlsx.write(res);
};

const generatePDF = async (res, stats, dateFilter, startDate, endDate) => {
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${dateFilter}.pdf`);

    doc.pipe(res);

    // Add title and date range
    doc.fontSize(16).text('Sales Report', { align: 'center' });
    doc.fontSize(12).text(`Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, { align: 'center' });
    doc.moveDown();

    // Add summary
    doc.fontSize(14).text('Sales Summary');
    doc.fontSize(12);
    doc.text(`Total Orders: ${stats.totalOrders}`);
    doc.text(`Total Sales: ₹${stats.totalSales}`);
    doc.text(`Total Discount: ₹${stats.totalDiscount}`);

    doc.end();
};
module.exports = {
    getSalesReport,
    filterSalesReport,
    downloadReport
};