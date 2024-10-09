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

//checkout
const loadCheckout = async (req, res) => {
  try {
    const user = req.session.user;
    if (user) {
      const cartItems = await Cart.findOne({ userId: user._id });

      if (!cartItems || cartItems.items.length === 0) {
        return res.status(400).send("Your cart is empty.");
      }

      const unavailableProducts = [];
      const availableProducts = [];
      let grandTotal = 0;

      for (const item of cartItems.items) {
        const product = await Product.findById(item.product).populate(
          "category",
          "offer"
        );

        if (!product || !product.isListed || product.quantity < item.quantity) {
          unavailableProducts.push({
            id: product._id,
            name: product ? product.name : "Unknown",
            status:
              !product || !product.isListed
                ? "Blocked by Admin"
                : "Out of Stock",
          });
        } else {
          const originalPrice = product.price;

          const categoryDiscount =
            product.category && product.category.offer
              ? product.category.offer / 100
              : 0;
          const productDiscount = product.discount ? product.discount / 100 : 0;
          const highestDiscount = Math.max(categoryDiscount, productDiscount);
          const finalPrice = originalPrice - originalPrice * highestDiscount;
          const totalItemPrice = finalPrice * item.quantity;
          grandTotal += totalItemPrice;

          availableProducts.push({
            name: product.name,
            quantity: item.quantity,
            price: originalPrice,
            finalPrice: finalPrice.toFixed(2),
            appliedDiscountPercent: highestDiscount * 100,
          });
        }
      }
      
      await Cart.updateOne({ userId: user._id }, { $set: { grandTotal } });

      const addresses = await Address.find({ userId: user._id });

      const previousOrders = await Order.find({ userId: user._id }).select(
        "coupons -_id"
      );
      const usedCoupons = previousOrders.flatMap((order) => order.coupons);

      const activeCoupons = await Coupon.find({
        status: "active",
        min_order_price: { $lte: grandTotal },
        code: { $nin: usedCoupons },
      });

      res.render("checkout", {
        user: user,
        addresses,
        availableProducts,
        unavailableProducts,
        grandTotal: grandTotal.toFixed(2),
        coupons: activeCoupons,
      });
    }
  } catch (error) {
    console.log("checkout page not found:", error);
    res.status(500).send("Server Error");
  }
};

const placeOrder = async (req, res) => {
  try {
    const user = req.session.user;
    const { delivery_address, payment_method, grandTotal, appliedCoupon } = req.body;

    if (!delivery_address || !payment_method) {
      return res.status(400).json({
        error: 'validation_error',
        message: "Delivery address and payment method are required."
      });
    }

    const addressFull = await Address.findById(delivery_address);
    if (!addressFull) {
      return res.status(404).json({
        error: 'address_not_found',
        message: "Address not found."
      });
    }

    let couponDetails = null;
    if (appliedCoupon && appliedCoupon.trim() !== "") {
      couponDetails = await Coupon.findOne({ code: appliedCoupon });
      if (!couponDetails) {
        console.log(`Coupon not found: ${appliedCoupon}`);
      }
    }

    const cart = await Cart.findOne({ userId: user._id }).populate({
      path: "items.product",
      select: "name price images",
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        error: 'empty_cart',
        message: "Your cart is empty."
      });
    }

    await Cart.updateOne(
      { userId: user._id },
      { $set: { grandTotal: grandTotal } }
    );

    if (payment_method === "Wallet") {
      const userWallet = await Wallet.findOne({ userId: user._id });

      if (!userWallet || userWallet.balance < parseFloat(grandTotal)) {
        return res.status(400).json({
          error: "insufficient_balance",
          message: "Insufficient wallet balance",
          requiredAmount: parseFloat(grandTotal),
          currentBalance: userWallet ? userWallet.balance : 0,
        });
      }
    }

    const renderData = {
      address: {
        name: addressFull.name,
        houseName: addressFull.houseName,
        street: addressFull.street,
        city: addressFull.city,
        country: addressFull.country,
        zipcode: addressFull.zipcode,
        mobile: addressFull.mobile,
      },
      cartItems: cart.items.map((item) => ({
        product: {
          _id: item.product._id,
          name: item.product.name,
          price: item.product.price,
          image: item.product.images[0],
        },
        quantity: item.quantity,
        finalPrice: item.finalPrice,
      })),
      paymentMethod: payment_method,
      user,
      grandTotal,
    };

    if (couponDetails) {
      renderData.appliedCoupon = {
        _id: couponDetails._id,
        code: couponDetails.code,
        discount_rs: couponDetails.discount_rs,
      };
    }

    // Render the confirmation page and send it as a response
    res.render("confirmOrder", renderData);
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({
      error: 'server_error',
      message: "An error occurred while processing your order."
    });
  }
};
//order confirmation
const confirmOrder = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id;
    const { paymentMethod } = req.body;
    const addressId = JSON.parse(req.body.addressId);
    let appliedCoupon = req.body.appliedCoupon;

    if (typeof appliedCoupon === "string") {
      appliedCoupon = JSON.parse(appliedCoupon);
    }

    const address = addressId;

    if (!address) {
      return res.status(400).json({ message: "Address is required" });
    }

    const paymentMethodEnum = paymentMethod;
    if (!paymentMethodEnum) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const cart = await Cart.findOne({ userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let orderItems = [];
    const grandTotal = cart.grandTotal;

    for (const cartItem of cart.items) {
      const product = cartItem.product;
      const quantity = cartItem.quantity;
      const finalPrice = cartItem.finalPrice;

      if (
        !product ||
        !product.isListed ||
        product.quantity < quantity ||
        product.quantity === 0
      ) {
        continue;
      }

      orderItems.push({
        productId: product._id,
        quantity: quantity,
        price: product.price,
        subtotal: finalPrice * quantity,
      });

      product.quantity -= quantity;
      if (product.quantity === 0) {
        product.status = "Out of Stock";
      }
      await product.save();
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ message: "No products are available" });
    }
    const newOrder = new Order({
      userId,
      address: {
        name: address.name,
        houseName: address.houseName,
        street: address.street,
        city: address.city,
        country: address.country,
        zipcode: address.zipcode,
        mobile: address.mobile,
      },
      items: orderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        deliveryStatus: "Pending",
      })),
      grandTotal,
      paymentMethod: paymentMethodEnum,
      paymentStatus:
        paymentMethodEnum === "Cash on Delivery" ? "Pending" : "Initiated",
      coupons:
        appliedCoupon && typeof appliedCoupon.code === "string"
          ? appliedCoupon.code
          : null,
    });

    await newOrder.save();

    if (appliedCoupon && appliedCoupon.code) {
      const coupon = await Coupon.findOne({ code: appliedCoupon.code });

      if (coupon) {
        coupon.used_count += 1;

        if (coupon.used_count >= coupon.usage_limit) {
          coupon.status = "expired";
        }

        await coupon.save();
      }
    }

    await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [], grandTotal: 0 } }
    );

    if (paymentMethodEnum === "Wallet") {
      let wallet = await Wallet.findOne({ userId: req.session.user._id });

      if (!wallet || wallet.balance < grandTotal) {
        return res.status(400).json({ message: "Insufficient wallet balance" });
      }

      wallet.balance = Number((wallet.balance - grandTotal).toFixed(2));

      const transactionId = generateTransactionId();
      const transaction = {
        type: "debit",
        amount: grandTotal,
        description: `Paid for new order with ID: ${newOrder._id}`,
        date: new Date(),
        transactionId,
      };

      wallet.transactions.push(transaction);
      await wallet.save();

      newOrder.paymentStatus = "Paid";
      await newOrder.save();
    }

    await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [], grandTotal: 0 } }
    );

    if (
      paymentMethodEnum === "Wallet" ||
      paymentMethodEnum === "Cash on Delivery"
    ) {
      const populatedOrder = await Order.findById(newOrder._id).populate(
        "items.productId"
      );
      return res.render("orderPlaced", { user, order: populatedOrder });
    } else {
      const razorpayOrder = await razorpay.orders.create({
        amount: grandTotal * 100,
        currency: "INR",
        receipt: newOrder.orderId,
        payment_capture: 1,
      });

      newOrder.razorpayOrderId = razorpayOrder.id;
      await newOrder.save();

      return res.render("razorpayCheckout", {
        user,
        order: newOrder,
        razorpayOrder,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      });
    }
  } catch (error) {
    console.error("Error in confirmOrder:", error);
    return res
      .status(500)
      .json({ message: "Failed to place order", error: error.message });
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

      await Cart.findOneAndUpdate(
        { userId: order.userId },
        { $set: { items: [], grandTotal: 0 } }
      );

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
