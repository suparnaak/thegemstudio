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
//update different order statuses
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, paymentStatus, productId, newStatus } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
      await order.save();
      return res.json({ message: "Payment status updated successfully!" });
    }

    if (productId && newStatus) {
      const item = order.items.find((item) => item.productId.equals(productId));
      if (!item) {
        return res
          .status(404)
          .json({ message: "Product not found in the order" });
      }

      if (
        (item.deliveryStatus === "Pending" &&
          ["Delivered", "Admin Cancelled"].includes(newStatus)) ||
        (item.deliveryStatus === "Return Pending" && newStatus === "Returned")
      ) {
        item.deliveryStatus = newStatus;
        await order.save();

        if (newStatus === "Returned" || newStatus === "Admin Cancelled") {
          if (order.paymentStatus === "Paid") {
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
                `Invalid refund amount for order ${orderId} and product ${productId}`
              );
            }

            wallet.balance = Number((wallet.balance + refundAmount).toFixed(2));

            const transactionId = generateTransactionId();
            const transaction = {
              type: "credit",
              amount: refundAmount,
              description: `Refund for ${newStatus.toLowerCase()} order ${orderId}, product ${
                item.productName || productId
              }`,
              date: new Date(),
              transactionId,
            };

            wallet.transactions.push(transaction);
            await wallet.save();

            return res.json({
              message: `Delivery status updated and refund processed successfully!`,
              refunded: true,
              amount: refundAmount,
            });
          } else {
            return res.json({
              message: "Delivery status updated successfully!",
              refunded: false,
            });
          }
        } else {
          return res.json({ message: "Delivery status updated successfully!" });
        }
      } else {
        return res.status(400).json({ message: "Invalid status transition" });
      }
    }

    return res.status(400).json({ message: "Invalid request" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
//transaction id generation
function generateTransactionId() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

module.exports = {
  listOrders,
  listOrderDetails,
  updateOrderStatus,
};
