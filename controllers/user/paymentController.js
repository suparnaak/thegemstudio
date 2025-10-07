const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema")
const Razorpay = require('razorpay');
const crypto = require('crypto');
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")
// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const retryPayment = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        
        console.log('Retry payment request:', { orderId, amount });

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(STATUSCODES.BAD_REQUEST).json({ 
                success: false, 
                error: MESSAGES.ORDER.NOT_FOUND 
            });
        }

        if (order.paymentMethod === 'Cash On Delivery') {
            return res.status(STATUSCODES.BAD_REQUEST).json({ 
                success: false, 
                error: MESSAGES.PAYMENT.PAYMENT_ERROR_COD 
            });
        }

        if (!['Failed', 'Pending'].includes(order.paymentStatus)) {
            return res.status(STATUSCODES.BAD_REQUEST).json({ 
                success: false, 
                error: `Cannot retry payment for orders with status: ${order.paymentStatus}` 
            });
        }

        if (order.grandTotal !== amount) {
            return res.status(STATUSCODES.BAD_REQUEST).json({ 
                success: false, 
                error: `Amount mismatch. Expected: ${order.grandTotal}, Received: ${amount}` 
            });
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(amount * 100), 
            currency: 'INR',
            receipt: orderId,
        });

        res.json({
            success: true,
            amount: Math.round(amount * 100),
            razorpayOrderId: razorpayOrder.id,
            orderId: orderId
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            error: MESSAGES.GENERAL.SERVER_ERROR,
            details: error.message 
        });
    }
};
const verifyRetryPayment = async (req, res) => {
    try {
        const { payment, order } = req.body;
        
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(order.razorpayOrderId + '|' + payment.razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        if (generated_signature === payment.razorpay_signature) {
            const updated = await Order.findByIdAndUpdate(order.orderId, {
    paymentStatus: 'Paid',
    razorpayPaymentId: payment.razorpay_payment_id
  }, { new: true });

  await Cart.findOneAndUpdate(
    { userId: updated.userId },
    { items: [], grandTotal: 0 }
  );

            res.json({ success: true });
        } else {
            res.json({ success: false, error: MESSAGES.PAYMENT.VERIFY_FAILED });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ success: false, error: MESSAGES.GENERAL.SERVER_ERROR });
    }
};
module.exports = {
    retryPayment,
    verifyRetryPayment
}