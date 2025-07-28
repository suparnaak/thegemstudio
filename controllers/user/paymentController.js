const Order = require("../../models/orderSchema");
const Razorpay = require('razorpay');
const crypto = require('crypto');
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
            return res.status(400).json({ 
                success: false, 
                error: 'Order not found' 
            });
        }

        if (order.paymentMethod === 'Cash On Delivery') {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot retry payment for Cash On Delivery orders' 
            });
        }

        if (!['Failed', 'Pending'].includes(order.paymentStatus)) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot retry payment for orders with status: ${order.paymentStatus}` 
            });
        }

        if (order.grandTotal !== amount) {
            return res.status(400).json({ 
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
        res.status(500).json({ 
            success: false, 
            error: 'Unable to create payment order',
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
            res.json({ success: false, error: 'Payment verification failed' });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ success: false, error: 'Payment verification failed' });
    }
};
module.exports = {
    retryPayment,
    verifyRetryPayment
}