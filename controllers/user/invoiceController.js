const User = require("../../models/userSchema");
const Product = require("../../models/productsSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema")
const PDFDocument = require('pdfkit');
const fs = require('fs');

const downloadInvoice = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        console.log('orderid:', orderId);

        const order = await Order.findOne({ _id: orderId }).populate('items.productId');
        console.log('order', order);

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const item = order.items.find(item => item.productId._id.toString() === productId);
        if (!item) {
            return res.status(404).send('Product not found in this order');
        }

        const invoiceNumber = order.invoiceNumber;

        let coupon = null;
        let discountAmount = 0;
        if (order.coupons) {
            coupon = await Coupon.findOne({ code: order.coupons });
            if (coupon) {
                discountAmount = coupon.discount_rs;
            }
        }

        // Calculate the total number of items in the order
        const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

        // Calculate the discount per item
        const discountPerItem = discountAmount / totalItems;

        // Calculate the discount for this specific item
        const itemDiscount = discountPerItem * item.quantity;

        const doc = new PDFDocument({ margin: 50 });
        let filename = `invoice_${invoiceNumber}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');
        
        doc.pipe(res);

        // Helper function for bold labels
        const drawBoldLabel = (text, x, y) => {
            doc.font('Helvetica-Bold').text(text, x, y);
            doc.font('Helvetica');  // Reset to regular font
        };

        // Header
        doc.fontSize(20).text('Invoice', { align: 'center' });
        doc.moveDown();

        // Invoice details
        const detailsStartY = doc.y;
        doc.fontSize(10);

        drawBoldLabel('Invoice Number:', 50, detailsStartY);
        doc.text(invoiceNumber, 150, detailsStartY);
        
        drawBoldLabel('Order ID:', 50, detailsStartY + 20);
        doc.text(order.orderId, 150, detailsStartY + 20);
        
        drawBoldLabel('Order Date:', 50, detailsStartY + 40);
        doc.text(order.orderDate.toLocaleDateString(), 150, detailsStartY + 40);

        // Payment details
        const paymentIdY = detailsStartY;
        drawBoldLabel('Payment Transaction ID:', 300, paymentIdY);
        doc.text(order.razorpayPaymentId || 'N/A', 300, paymentIdY + 15, { width: 240 });

        const paymentMethodY = Math.max(doc.y + 10, paymentIdY + 40);
        drawBoldLabel('Payment Method:', 300, paymentMethodY);
        doc.text(order.paymentMethod, 400, paymentMethodY);
        
        drawBoldLabel('Payment Status:', 300, paymentMethodY + 20);
        doc.text(order.paymentStatus, 400, paymentMethodY + 20);
        
        doc.moveDown(4);

        // Addresses with bold headers
        const addressY = doc.y;
        doc.font('Helvetica-Bold').text('Sold By:', 50, addressY, { underline: true });
        doc.font('Helvetica')
           .text('THE GEM STUDIO PVT LTD')
           .text('BEHALA, WEST BENGAL 700061');
        
        doc.font('Helvetica-Bold').text('Delivery Address:', 300, addressY, { underline: true });
        doc.font('Helvetica')
           .text(order.address.name)
           .text(`${order.address.houseName}, ${order.address.street}`)
           .text(`${order.address.city}, ${order.address.country}, ${order.address.zipcode}`)
           .text(`Phone: ${order.address.mobile}`);

        doc.moveDown(2);

        doc.font('Helvetica-Bold').fontSize(12).text('Order Details:', { underline: true });
        doc.moveDown();

        const tableTop = doc.y;
        const tableHeaders = ['Sl No.', 'Product', 'Quantity', 'Unit Price', 'Subtotal'];
        const tableWidths = [30, 150, 50, 70, 70, 70, 70];
        const colStartX = [50, 80, 230, 280, 350, 420, 490];

        // Draw table headers
        tableHeaders.forEach((header, i) => {
            doc.font('Helvetica-Bold').fontSize(10)
               .text(header, colStartX[i], tableTop, { 
                   width: tableWidths[i], 
                   align: i > 1 ? 'right' : 'left'
               });
        });

        // Draw table row for the single product
        let tableRowY = tableTop + 20;
        doc.font('Helvetica');

        doc.text("1", colStartX[0], tableRowY, { width: tableWidths[0], align: 'left' });
        doc.text(item.productId.name, colStartX[1], tableRowY, { width: tableWidths[1], align: 'left' });
        doc.text(item.quantity.toString(), colStartX[2], tableRowY, { width: tableWidths[2], align: 'right' });
        doc.text(`₹${item.price.toFixed(2)}`, colStartX[3], tableRowY, { width: tableWidths[3], align: 'right' });
        doc.text(`₹${item.subtotal.toFixed(2)}`, colStartX[4], tableRowY, { width: tableWidths[4], align: 'right' });
        

        doc.moveDown(2);

        // Totals section
        const totalsStartX = 350;
        let currentY = doc.y;

        const drawTotalLine = (label, value, isBold = false) => {
            if (isBold) {
                doc.font('Helvetica-Bold');
            } else {
                doc.font('Helvetica');
            }
            doc.text(label, totalsStartX, currentY, { width: 100, align: 'left' });
            doc.text(value, totalsStartX + 100, currentY, { width: 100, align: 'right' });
            currentY += 20;
        };

        drawTotalLine('Subtotal:', `₹${item.subtotal.toFixed(2)}`, false);
        if (itemDiscount > 0) {
            drawTotalLine('Coupon Discount:', `-₹${itemDiscount.toFixed(2)}`, false);
        }
        drawTotalLine('Grand Total:', `₹${(item.subtotal - itemDiscount).toFixed(2)}`, true);

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while generating the invoice');
    }
};

module.exports = {
    downloadInvoice,
};