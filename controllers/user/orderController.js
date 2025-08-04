const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productsSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const Coupon = require("../../models/couponSchema");
const crypto = require("crypto");
const Razorpay = require("razorpay");
require("dotenv").config();

//razor pay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const generateInvoiceNumber = () => {
  return "KOLK-" + crypto.randomBytes(8).toString("hex").toUpperCase();
};
//checkout
const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cartDoc = await Cart.findOne({ userId }).populate({
      path: "items.product",
      model: "Product",
      select: "name images price discount quantity isListed",
      populate: {
        path: "category",
        model: "Category",
        select: "offer",
      },
    });

    const unavailableProducts = [];
    const availableProducts   = [];
    let   grandTotal          = 0;

    if (!cartDoc || cartDoc.items.length === 0) {
      return res.render("checkout", {
        user:               req.session.user,
        addresses:          [],
        availableProducts:  [],
        unavailableProducts,
        grandTotal:         "0.00",
        coupons:            [],
        errorMessage:       "Your cart is empty. Add items before checking out."
      });
    }

    for (let item of cartDoc.items) {
      const p = item.product;
      if (!p || !p.isListed || p.quantity < item.quantity) {
        unavailableProducts.push({
          id: p?._id,
          name: p?.name || "Unknown Product",
          images: p?.images || [],
          status: !p
            ? "Product not found"
            : !p.isListed
            ? "Blocked by Admin"
            : "Out of Stock"
        });
      } else {
        const catOff   = p.category?.offer / 100 || 0;
        const prodOff  = p.discount  / 100 || 0;
        const topOff   = Math.max(catOff, prodOff);
        const finalP   = p.price - (p.price * topOff);
        availableProducts.push({
          product: p,
          quantity: item.quantity,
          finalPrice: finalP,
          appliedDiscountPercent: (topOff * 100).toFixed(2)
        });
        grandTotal += finalP * item.quantity;
      }
    }

    if (unavailableProducts.length > 0) {
      const addresses     = await Address.find({ userId });
      const prevOrders    = await Order.find({ userId }).select("coupons -_id");
      const usedCoupons   = prevOrders.flatMap(o => o.coupons);
      const coupons       = await Coupon.find({
        status:          "active",
        min_order_price: { $lte: grandTotal },
        code:            { $nin: usedCoupons }
      });
      return res.render("checkout", {
        user:               req.session.user,
        addresses,
        availableProducts,
        unavailableProducts,
        grandTotal:         grandTotal.toFixed(2),
        coupons,
        errorMessage:       "Some items are no longer available. Please review your cart."
      });
    }

    const addresses     = await Address.find({ userId });
    const prevOrders    = await Order.find({ userId }).select("coupons -_id");
    const usedCoupons   = prevOrders.flatMap(o => o.coupons);
    const coupons       = await Coupon.find({
      status:          "active",
      min_order_price: { $lte: grandTotal },
      code:            { $nin: usedCoupons }
    });

    return res.render("checkout", {
      user:               req.session.user,
      addresses,
      availableProducts,
      unavailableProducts: [],
      grandTotal:         grandTotal.toFixed(2),
      coupons
    });

  } catch (error) {
    console.error("checkout page error:", error);
    return res.render("checkout", {
      user:               req.session.user,
      addresses:          [],
      availableProducts:  [],
      unavailableProducts: [],
      grandTotal:         "0.00",
      coupons:            [],
      errorMessage:       "Server error loading checkout. Please try again."
    });
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { delivery_address, payment_method, grandTotal, appliedCoupon } = req.body;

    if (!delivery_address || !payment_method) {
      return loadCheckout(req, res); 
    }

    const addressFull = await Address.findById(delivery_address);
    if (!addressFull) {
      req.body.delivery_address = null;
      return loadCheckout(req, res);
    }

    let couponDetails = null;
    if (appliedCoupon && appliedCoupon.trim() !== "") {
      couponDetails = await Coupon.findOne({ code: appliedCoupon });
    }

    const cartDoc = await Cart.findOne({ userId }).populate({
      path: "items.product",
      model: "Product",
      select: "name images price discount quantity isListed",
      populate: { path: "category", model: "Category", select: "offer" },
    });
    const unavailable = cartDoc.items.filter(item => !item.product || !item.product.isListed || item.product.quantity < item.quantity);
    if (unavailable.length > 0) {
      return loadCheckout(req, res);
    }

    const cartItemsData = cartDoc.items.map(item => ({
      product: { _id: item.product._id, name: item.product.name, price: item.product.price, image: item.product.images[0] },
      quantity: item.quantity,
      finalPrice: item.finalPrice
    }));

    const renderData = {
      user: req.session.user,
      address: addressFull,
      cartItems: cartItemsData,
      paymentMethod: payment_method,
      grandTotal: parseFloat(grandTotal),
      appliedCoupon: couponDetails ? { _id: couponDetails._id, code: couponDetails.code, discount_rs: couponDetails.discount_rs } : null
    };

    return res.render("confirmOrder", renderData);

  } catch (error) {
    console.error("Error in placeOrder:", error);
    return loadCheckout(req, res);
  }
};
//order confirmation
const confirmOrder = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id;

    let existingOrder = await Order.findOne({
      userId,
      paymentMethod: { $nin: ["Wallet", "Cash on Delivery"] },
      paymentStatus: "Initiated"
    });
    if (existingOrder) {
      return res.render("razorpayCheckout", {
        user,
        order: existingOrder,
        razorpayOrder: { id: existingOrder.razorpayOrderId },
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      });
    }

    const { paymentMethod } = req.body;
    const address = JSON.parse(req.body.addressId);
    let appliedCoupon = req.body.appliedCoupon;
    if (typeof appliedCoupon === "string") {
      appliedCoupon = JSON.parse(appliedCoupon);
    }

    if (!address) {
      return res.status(400).json({ message: "Address is required" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const cart = await Cart.findOne({ userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    for (const item of cart.items) {
      const reserved = await Product.findOneAndUpdate(
        { _id: item.product._id, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity } },
        { new: true }
      );

      if (!reserved) {
        const unavailableProducts = [{
          id:      item.product._id,
          name:    item.product.name,
          images:  item.product.images,
          status:  "Out of Stock"
        }];
        const availableItems = [];
        let newTotal = 0;
        for (const ci of cart.items) {
          if (
            !ci.product._id.equals(item.product._id) &&
            ci.product.isListed &&
            ci.product.quantity >= ci.quantity
          ) {
            const price = ci.product.price;
            const categoryOffer = ci.product.category?.offer || 0;
            const productDiscount = ci.product.discount || 0;
            const bestOff = Math.max(categoryOffer, productDiscount) / 100;
            const finalPrice = price * (1 - bestOff);

            newTotal += finalPrice * ci.quantity;
            availableItems.push({
              product: ci.product,
              quantity: ci.quantity,
              finalPrice,
              appliedDiscountPercent: bestOff * 100
            });
          }
        }
        return res.status(400).render("cart", {
          user:               req.session.user,
          cart:               availableItems,
          grandTotal:         newTotal.toFixed(2),
          unavailableProducts
        });
      }

      if (reserved.quantity === 0) {
        reserved.status = "Out of Stock";
        await reserved.save();
      }
    }

    const orderItems = cart.items.map(item => ({
      productId: item.product._id,
      quantity: item.quantity,
      price: item.product.price,
      subtotal: item.finalPrice * item.quantity,
      deliveryStatus: "Pending"
    }));
    const grandTotal = cart.grandTotal;
    const invoiceNumber = generateInvoiceNumber();

    const newOrder = new Order({
      userId,
      address,
      items: orderItems,
      grandTotal,
      paymentMethod,
      paymentStatus: paymentMethod === "Cash on Delivery" ? "Pending" : "Initiated",
      coupons: appliedCoupon?.code || null,
      invoiceNumber
    });
    await newOrder.save();
    await Cart.findOneAndUpdate(
  { userId },
  { $set: { items: [], grandTotal: 0 } }
);
    if (appliedCoupon?.code) {
      const coupon = await Coupon.findOne({ code: appliedCoupon.code });
      if (coupon) {
        coupon.used_count = (coupon.used_count || 0) + 1;
        if (coupon.used_count >= coupon.usage_limit) coupon.status = "expired";
        await coupon.save();
      }
    }

    if (paymentMethod === "Wallet") {
      let wallet = await Wallet.findOne({ userId });
      wallet.balance -= grandTotal;
      wallet.transactions.push({
        type: "debit",
        amount: grandTotal,
        description: `Order ${newOrder.orderId}`,
        date: new Date(),
        transactionId: generateTransactionId()
      });
      await wallet.save();
      newOrder.paymentStatus = "Paid";
      await newOrder.save();
      const populated = await Order.findById(newOrder._id).populate("items.productId");
      return res.render("orderPlaced", { user, order: populated });
    }
    if (paymentMethod === "Cash on Delivery") {
      const populated = await Order.findById(newOrder._id).populate("items.productId");
      return res.render("orderPlaced", { user, order: populated });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: grandTotal * 100,
      currency: "INR",
      receipt: newOrder.orderId,
      payment_capture: 1
    });
    newOrder.razorpayOrderId = razorpayOrder.id;
    await newOrder.save();

    return res.render("razorpayCheckout", {
      user,
      order: newOrder,
      razorpayOrder,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("Error in confirmOrder:", error);
    return res.status(500).json({ message: "Failed to place order", error: error.message });
  }
};

//verify payment with razor pay
const verifyPayment = async (req, res) => {
  try {
    const user = req.session.user;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentFailed,
    } = req.query;

    let order;

    if (paymentFailed === "true") {
      order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { paymentStatus: "Failed" },
        { new: true }
      ).populate("items.productId");

      return res.render("orderPlaced", { user, order });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          paymentStatus: "Paid",
          razorpayPaymentId: razorpay_payment_id,
        },
        { new: true }
      ).populate("items.productId");

      res.render("orderPlaced", { user, order });
    } else {
      order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { paymentStatus: "Failed" },
        { new: true }
      ).populate("items.productId");

      res.render("orderPlaced", { user, order });
    }
  } catch (error) {
    console.error("Error in verifyPayment:", error);
    res
      .status(500)
      .json({ message: "Payment verification failed", error: error.message });
  }
};

//load cancel order
const loadCancelOrder = async (req, res) => {
  const user = req.session.user;
  const userId = user._id;
  const orderId = req.params.orderId;
  const productId = req.params.productId;

  const order = await Order.findOne({ _id: orderId, userId: userId });
  const product = await Product.findById(productId);

  if (!order || !product) {
    return res.render("cancelOrder", {
      user,
      order: null,
      message: "No order found",
    });
  }
  const item = order.items.find((item) => item.productId.equals(productId));
  if (!item) {
    return res.render("cancelOrder", {
      order,
      user,
      item: null,
      message: "No product found",
    });
  }
  res.render("cancelOrder", { order, product, user, item });
};

//cancel an order
const cancelOrder = async (req, res) => {
  try {
    const { orderId, productId, cancelReason } = req.params;
    const user = req.session.user;
    const userId = user._id;
    const product = await Product.findById(productId);
    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
      items: { $elemMatch: { productId: productId } },
    });

    if (!order || !product) {
      return res.render("cancelOrder", {
        user: user,
        order: null,
        message: "Order or product not found",
      });
    }

    const itemToCancel = order.items.find((item) =>
      item.productId.equals(productId)
    );

    if (!itemToCancel) {
      return res.render("cancelOrder", {
        user: user,
        order: null,
        message: "Product not found in the order",
      });
    }

    product.quantity += itemToCancel.quantity;
    if (product.status !== "Available") {
      product.status = "Available";
    }
    await product.save();

    itemToCancel.deliveryStatus = "Cancelled";
    itemToCancel.cancelReason = cancelReason;

    await Order.updateOne(
      { _id: orderId, "items.productId": productId },
      {
        $set: {
          "items.$.deliveryStatus": "Cancelled",
          "items.$.cancelReason": cancelReason,
        },
      }
    );

    if (order.paymentStatus === "Paid") {
      let wallet = await Wallet.findOne({ userId: req.session.user._id });

      if (!wallet) {
        wallet = new Wallet({
          userId: req.session.user._id,
          balance: 0,
          transactions: [],
        });
      }

      const totalSubtotal = order.items.reduce(
        (total, item) => total + item.subtotal,
        0
      );
      const adjustmentPerItem =
        (totalSubtotal - order.grandTotal) / order.items.length;
      const refundAmount = Number(
        itemToCancel.subtotal - adjustmentPerItem
      ).toFixed(2);

      if (isNaN(refundAmount)) {
        throw new Error(`Invalid refund amount: ${refundAmount}`);
      }

      wallet.balance = Number(
        (wallet.balance + parseFloat(refundAmount)).toFixed(2)
      );

      const transactionId = generateTransactionId();
      const transaction = {
        type: "credit",
        amount: refundAmount,
        description: `Refund for canceled order ${order.orderId}, product ${product.name}`,
        date: new Date(),
        transactionId,
      };

      wallet.transactions.push(transaction);

      await wallet.save();
    }

    res.redirect(`/my-orders/cancel-confirmation/${orderId}/${productId}`);
  } catch (error) {
    console.error(error);
    res.render("cancelOrder", {
      user: req.session.user,
      message: "Internal server error",
    });
  }
};
//transaction id generation
function generateTransactionId() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

//canccellation confirmation
const loadCancelConfirmation = async (req, res) => {
  const { orderId, productId } = req.params;
  const user = req.session.user;
  const userId = user._id;

  const product = await Product.findById(productId);
  const order = await Order.findOne({
    _id: orderId,
    userId: userId,
    items: { $elemMatch: { productId: productId } },
  });

  if (!order || !product) {
    return res.render("cancelOrder", {
      user: user,
      order: null,
      message: "Order or product not found",
    });
  }
  const canceledItem = order.items.find((item) =>
    item.productId.equals(productId)
  );

  if (!canceledItem) {
    return res.render("cancelOrder", {
      user: user,
      order: null,
      message: "Order or product not found",
    });
  }

  res.render("cancelConfirmation", {
    order,
    product,
    user: req.session.user,
    cancelReason: canceledItem.cancelReason,
  });
};

//load return order
const loadReturnOrder = async (req, res) => {
  const user = req.session.user;
  const userId = user._id;
  const orderId = req.params.orderId;
  const productId = req.params.productId;

  const order = await Order.findOne({ _id: orderId, userId: userId });
  const product = await Product.findById(productId);

  if (!order || !product) {
    return res.render("returnOrder", {
      user,
      order: null,
      message: "No order found",
    });
  }
  const item = order.items.find((item) => item.productId.equals(productId));
  if (!item) {
    return res.render("returnOrder", {
      order,
      user,
      item: null,
      message: "No product found",
    });
  }
  res.render("returnOrder", { order, product, user, item });
};

//return an order
const returnOrder = async (req, res) => {
  try {
    const { orderId, productId, returnReason } = req.params;
    const user = req.session.user;
    const userId = user._id;
    const product = await Product.findById(productId);
    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
      items: { $elemMatch: { productId: productId } },
    });

    if (!order || !product) {
      return res.render("returnOrder", {
        user: user,
        order: null,
        message: "Order or product not found",
      });
    }

    const itemToReturn = order.items.find((item) =>
      item.productId.equals(productId)
    );

    if (!itemToReturn) {
      return res.render("returnOrder", {
        user: user,
        order: null,
        message: "Product not found in the order",
      });
    }

    product.quantity += itemToReturn.quantity;
    if (product.status !== "Available") {
      product.status = "Available";
    }
    await product.save();

    itemToReturn.deliveryStatus = "Return Pending";
    itemToReturn.returnReason = returnReason;

    await Order.updateOne(
      { _id: orderId, "items.productId": productId },
      {
        $set: {
          "items.$.deliveryStatus": "Return Pending",
          "items.$.returnReason": returnReason,
        },
      }
    );

    res.redirect(`/my-orders/return-confirmation/${orderId}/${productId}`);
  } catch (error) {
    console.error(error);
    res.render("returnOrder", {
      user: req.session.user,
      message: "Internal server error",
    });
  }
};

const loadReturnConfirmation = async (req, res) => {
  const { orderId, productId } = req.params;
  const user = req.session.user;
  const userId = user._id;

  const product = await Product.findById(productId);
  const order = await Order.findOne({
    _id: orderId,
    userId: userId,
    items: { $elemMatch: { productId: productId } },
  });

  if (!order || !product) {
    return res.render("returnOrder", {
      user: user,
      order: null,
      message: "Order or product not found",
    });
  }
  const returnedItem = order.items.find((item) =>
    item.productId.equals(productId)
  );

  if (!returnedItem) {
    return res.render("returnOrder", {
      user: user,
      order: null,
      message: "Order or product not found",
    });
  }

  res.render("returnConfirmation", {
    order,
    product,
    user: req.session.user,
  });
};
module.exports = {
  loadCheckout,
  placeOrder,
  confirmOrder,
  loadCancelOrder,
  cancelOrder,
  loadCancelConfirmation,
  verifyPayment,
  loadReturnOrder,
  returnOrder,
  loadReturnConfirmation,
};
