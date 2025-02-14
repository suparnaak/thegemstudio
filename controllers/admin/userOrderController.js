const Product = require("../../models/productsSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");

//list orders
const listOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const orders = await Order.find({})
      .populate("userId", "name email")
      .populate("items.productId", "name price discount")
      .skip(skip)
      .limit(limit)
      .sort({ orderDate: -1 });

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("orders-list", {
      orders: orders || [],
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log("Error listing orders:", error);
    res.render("orders-list", {
      orders: [],
      currentPage: 1,
      totalPages: 1,
      error: "An error occurred while fetching orders.",
    });
  }
};

//list detailed orders
const listOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate("userId", "name email")
      .populate("items.productId", "name price discount");

    if (!order) {
      return res.status(404).send("Order not found");
    }
    res.render("order-details", { order });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).send("An error occurred while fetching order details");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, productId, newStatus } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.items.find((item) => item.productId.equals(productId));
    if (!item) {
      return res.status(404).json({ message: "Product not found in the order" });
    }

    const product = await Product.findById(item.productId);
    if (!product) {
      return res.status(404).json({ message: "Product details not found" });
    }
    const productName = product.name;

    const validStatusTransitions = {
      'Pending': ['Shipped', 'Admin Cancelled'],
      'Shipped': ['On Transit'],
      'On Transit': ['Out for Delivery'],
      'Out for Delivery': ['Delivered'],
      'Return Pending': ['Returned']
    };

    if (!validStatusTransitions[item.deliveryStatus]?.includes(newStatus)) {
      return res.status(400).json({ 
        message: `Invalid status transition from ${item.deliveryStatus} to ${newStatus}` 
      });
    }

    // Handle status updates based on payment method and status
    if (['Admin Cancelled', 'Return Pending', 'Returned'].includes(newStatus)) {

      item.deliveryStatus = newStatus;
    } else {
      // Regular status updates
      if (order.paymentMethod === 'Cash on Delivery') {
        // For COD orders - allow all status changes
        item.deliveryStatus = newStatus;
        // Update payment status to Paid when delivered
        if (newStatus === 'Delivered') {
          order.paymentStatus = 'Paid';
          item.deliveryDate = new Date();
        }
      } else {
        // For non-COD orders
        if (order.paymentStatus !== 'Paid' && item.deliveryStatus === 'Pending') {
          return res.status(400).json({ 
            message: "Payment not completed. Cannot update delivery status." 
          });
        }
        item.deliveryStatus = newStatus;
        if (newStatus === 'Delivered') {
          item.deliveryDate = new Date();
        }
      }
    }
    if ((newStatus === "Returned" || newStatus === "Admin Cancelled") && 
        order.paymentStatus === "Paid") {
      let wallet = await Wallet.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: 0,
          transactions: [],
        });
      }

      const totalSubtotals = order.items.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
      const refundAmount =
        item.subtotal - 
        (totalSubtotals - order.grandTotal) / order.items.length;

      if (isNaN(refundAmount)) {
        throw new Error(
          `Invalid refund amount for order ${order.orderId} and product ${productName}`
        );
      }

      wallet.balance = Number((wallet.balance + refundAmount).toFixed(2));

      const transactionId = generateTransactionId();
      
      const transaction = {
        type: "credit",
        amount: refundAmount,
        description: `Refund for ${newStatus.toLowerCase()} - Order #${order.orderId} - ${productName}`,
        date: new Date(),
        transactionId,
      };

      wallet.transactions.push(transaction);
      await wallet.save();
      await order.save();

      return res.json({
        message: `Delivery status updated and refund processed successfully!`,
        refunded: true,
        amount: refundAmount,
        newStatus: item.deliveryStatus,
        paymentStatus: order.paymentStatus
      });
    }

    await order.save();
    
    return res.json({ 
      message: "Delivery status updated successfully!",
      newStatus: item.deliveryStatus,
      deliveryDate: item.deliveryDate,
      paymentStatus: order.paymentStatus
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
function generateTransactionId() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

module.exports = {
  listOrders,
  listOrderDetails,
  updateOrderStatus,
};
