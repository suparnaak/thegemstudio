const User = require("../../models/userSchema");
const Product = require("../../models/productsSchema");
const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const fs = require('fs');

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        
        const order = await Order.findOne({ orderId }).populate('items.productId');
        
        if (!order) {
            return res.status(404).send('Order not found');
        }
        
        const invoiceNumber = generateRandomInvoiceNumber();
        
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
        
        // Left column with bold labels
        doc.fontSize(10);
        drawBoldLabel('Invoice Number:', 50, detailsStartY);
        doc.text(invoiceNumber, 150, detailsStartY);
        
        drawBoldLabel('Order ID:', 50, detailsStartY + 20);
        doc.text(order.orderId, 150, detailsStartY + 20);
        
        drawBoldLabel('Order Date:', 50, detailsStartY + 40);
        doc.text(order.orderDate.toLocaleDateString(), 150, detailsStartY + 40);

        // Right column - Payment details with proper wrapping and bold labels
        const paymentIdY = detailsStartY;
        drawBoldLabel('Payment Transaction ID:', 300, paymentIdY);
        
        const maxWidth = 240;
        doc.text(order.razorpayPaymentId || 'N/A', 300, paymentIdY + 15, {
            width: maxWidth,
            align: 'left'
        });

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

        // Order Details Table
        doc.font('Helvetica-Bold').fontSize(12).text('Order Details:', { underline: true });
        doc.moveDown();

        // Table configuration
        const tableTop = doc.y;
        const tableHeaders = ['Sl No.', 'Product', 'Quantity', 'Unit Price', 'Offer Subtotal'];
        const tableWidths = [40, 220, 70, 70, 100];
        const colStartX = [50, 90, 310, 380, 450];

        // Draw table headers with bold font
        tableHeaders.forEach((header, i) => {
            doc.font('Helvetica-Bold').fontSize(10)
               .text(header, colStartX[i], tableTop, { 
                   width: tableWidths[i], 
                   align: i > 1 ? 'right' : 'left'
               });
        });

        // Reset to regular font for table content
        doc.font('Helvetica');

        // Draw table rows
        let tableRowY = tableTop + 20;
        
        order.items.forEach((item, index) => {
            const rowHeight = 20;
            
            doc.text((index + 1).toString(), colStartX[0], tableRowY, {
                width: tableWidths[0],
                align: 'left'
            });
            
            const productNameHeight = doc.heightOfString(item.productId.name, {
                width: tableWidths[1],
                align: 'left'
            });
            doc.text(item.productId.name, colStartX[1], tableRowY, {
                width: tableWidths[1],
                align: 'left'
            });
            
            doc.text(item.quantity.toString(), colStartX[2], tableRowY, {
                width: tableWidths[2],
                align: 'right'
            });
            
            doc.text(`₹${item.price.toFixed(2)}`, colStartX[3], tableRowY, {
                width: tableWidths[3],
                align: 'right'
            });
            
            doc.text(`₹${item.subtotal.toFixed(2)}`, colStartX[4], tableRowY, {
                width: tableWidths[4],
                align: 'right'
            });
            
            tableRowY += Math.max(productNameHeight, rowHeight);
        });

        // Totals section
        doc.moveDown(2);

        // Calculate totals
        const totalBeforeDiscount = order.items.reduce((sum, item) => sum + item.subtotal, 0);
        const couponDiscount = totalBeforeDiscount - order.grandTotal;

        // Configure totals section
        const totalsStartX = 350;
        const totalsValueX = 550;
        const totalsWidth = 200;
        let currentY = doc.y;

        // Helper function for drawing total lines
        const drawTotalLine = (label, value, options = {}) => {
            const defaultOptions = {
                labelFontSize: 10,
                valueFontSize: 10,
                isBold: false,
                drawLine: false,
                moveDown: true
            };
            const finalOptions = { ...defaultOptions, ...options };

            if (finalOptions.drawLine) {
                doc.moveTo(totalsStartX, currentY).lineTo(totalsValueX, currentY).stroke();
                currentY += 10;
            }

            if (finalOptions.isBold) {
                doc.font('Helvetica-Bold');
            } else {
                doc.font('Helvetica');
            }

            // Draw label
            doc.fontSize(finalOptions.labelFontSize)
               .text(label, totalsStartX, currentY, { 
                   width: totalsWidth, 
                   align: 'left'
               });

            // Draw value
            doc.fontSize(finalOptions.valueFontSize)
               .text(value, totalsStartX, currentY, { 
                   width: totalsWidth, 
                   align: 'right'
               });

            if (finalOptions.moveDown) {
                currentY += 20;
            }

            doc.font('Helvetica');
        };

        // Draw totals
        drawTotalLine('Total:', `₹${totalBeforeDiscount.toFixed(2)}`, {
            isBold: true,
            drawLine: true
        });

        drawTotalLine('Coupon Discount:', `-₹${couponDiscount.toFixed(2)}`, {
            isBold: true
        });

        drawTotalLine('', '', {
            drawLine: true,
            moveDown: false
        });

        // Grand Total
        drawTotalLine('Grand Total:', `₹${order.grandTotal.toFixed(2)}`, {
            isBold: true,
            labelFontSize: 12,
            valueFontSize: 12
        });

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while generating the invoice');
    }
};
const generateRandomInvoiceNumber = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000); 
    return `KOLK-${randomNum}`;
};

module.exports = {
    downloadInvoice,
};