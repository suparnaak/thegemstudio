const Product = require("../../models/productsSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");

//list orders
const listOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();
    let filter = {};

    if (search) {
      const regex = new RegExp(search, "i");

      const matchingUsers = await User.find({
        $or: [{ name: regex }, { email: regex }],
      }).select("_id");

      const userIds = matchingUsers.map((u) => u._id);

      filter = {
        $or: [
          { orderId: regex },
          { userId: { $in: userIds } },
          { paymentStatus: regex },
        ],
      };
    }

    const orders = await Order.find(filter)
      .populate("userId", "name email")
      .skip(skip)
      .limit(limit)
      .sort({ orderDate: -1 });

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("orders-list", {
      orders,
      currentPage: page,
      totalPages,
      search,
      error: null,
    });
  } catch (err) {
    console.error("Error listing orders:", err);
    res.render("orders-list", {
      orders: [],
      currentPage: 1,
      totalPages: 1,
      search: req.query.search || "",
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

    const item = order.items.find((i) => i.productId.equals(productId));
    if (!item) {
      return res
        .status(404)
        .json({ message: "Product not found in the order" });
    }

    const product = await Product.findById(item.productId);
    if (!product) {
      return res.status(404).json({ message: "Product details not found" });
    }

    const validStatusTransitions = {
      Pending: ["Shipped", "Admin Cancelled"],
      Shipped: ["On Transit"],
      "On Transit": ["Out for Delivery"],
      "Out for Delivery": ["Delivered"],
      "Return Pending": ["Returned"],
    };
    if (!validStatusTransitions[item.deliveryStatus]?.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status transition from ${item.deliveryStatus} to ${newStatus}`,
      });
    }

    if (
      ["Admin Cancelled", "Returned"].includes(newStatus) &&
      order.paymentStatus === "Paid"
    ) {
      product.quantity += item.quantity;
      product.status = product.quantity > 0 ? "Available" : "Out of Stock";
      await product.save();

      item.deliveryStatus = newStatus;
      item.deliveryDate = new Date();

      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: 0,
          transactions: [],
        });
      }

      const allDiscountedTotal = order.items.reduce(
        (s, it) => s + it.subtotal,
        0
      );
      const totalCoupon = allDiscountedTotal - order.grandTotal;

      const myCouponShare =
        totalCoupon > 0
          ? (item.subtotal / allDiscountedTotal) * totalCoupon
          : 0;

      const refundAmount = item.subtotal - myCouponShare;

      if (isNaN(refundAmount)) {
        throw new Error(`Invalid refund calculation: ${refundAmount}`);
      }

      wallet.balance = Number((wallet.balance + refundAmount).toFixed(2));
      wallet.transactions.push({
        type: "credit",
        amount: refundAmount,
        description: `Refund for ${newStatus.toLowerCase()} - Order #${
          order.orderId
        } - ${product.name}`,
        date: new Date(),
        transactionId: generateTransactionId(),
      });
      await wallet.save();

      await order.save();
      return res.json({
        message: `Status '${newStatus}' & refunded ₹${refundAmount.toFixed(2)}`,
        refunded: true,
        amount: refundAmount,
        newStatus,
        paymentStatus: order.paymentStatus,
      });
    }

    if (["Admin Cancelled", "Return Pending"].includes(newStatus)) {
      item.deliveryStatus = newStatus;
    } else {
      if (order.paymentMethod === "Cash on Delivery") {
        item.deliveryStatus = newStatus;
        if (newStatus === "Delivered") {
          order.paymentStatus = "Paid";
          item.deliveryDate = new Date();
        }
      } else {
        if (
          order.paymentStatus !== "Paid" &&
          item.deliveryStatus === "Pending"
        ) {
          return res.status(400).json({
            message: "Payment not completed. Cannot update delivery status.",
          });
        }
        item.deliveryStatus = newStatus;
        if (newStatus === "Delivered") {
          item.deliveryDate = new Date();
        }
      }
    }

    await order.save();
    return res.json({
      message: "Delivery status updated successfully!",
      newStatus: item.deliveryStatus,
      deliveryDate: item.deliveryDate,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
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
