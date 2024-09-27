const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productsSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const crypto = require('crypto')
const Razorpay = require('razorpay');
require('dotenv').config();
//razor pay instance 
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
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

    for (const item of cartItems.items) {
      const product = await Product.findById(item.product);

      if (!product || !product.isListed || product.quantity < item.quantity) {
        unavailableProducts.push({
          id: product._id,
          name: product.name,
          status: !product.isListed ? "Blocked by Admin" : "Out of Stock",
        });
      } else {
        availableProducts.push({
          name: product.name,
          quantity: item.quantity,
          price: product.price,
        });
      }
    }
      const addresses = await Address.find({ userId: user._id });
      res.render("checkout", { user: user, 
        addresses,
        availableProducts,
        unavailableProducts});
    }
  } catch (error) {
    console.log("checkout page not found:", error);
    res.status(500).send("Server Error");
  }
};

//confirmation page
const placeOrder = async (req, res) => {
  try {
    const user = req.session.user;
    const { delivery_address, payment_method } = req.body;
    const addressFull = await Address.findById(delivery_address);
    if (!delivery_address || !payment_method) {
      return res
        .status(400)
        .send("Delivery address and payment method are required.");
    }

    const cartItems = await Cart.findOne({ userId: user._id });

    if (!cartItems || cartItems.items.length === 0) {
      return res.status(400).send("Your cart is empty.");
    }

    const unavailableProducts = [];
    const availableProducts = [];

    for (const item of cartItems.items) {
      const product = await Product.findById(item.product);

      if (!product || !product.isListed || product.quantity < item.quantity) {
        unavailableProducts.push({
          id: product._id,
          name: product.name,
          status: !product.isListed ? "Blocked by Admin" : "Out of Stock",
        });
      } else {
        availableProducts.push({
          name: product.name,
          quantity: item.quantity,
          price: product.price,
        });
      }
    }
    if (availableProducts.length === 0) {
      if (unavailableProducts.length > 0) {
        return res.status(400).send("No products are available.");
      } else {
        return res.status(400).send("Your cart is empty.");
      }
    }

    res.render("confirmOrder", {
      address: delivery_address,
      addressFull,
      availableProducts,
      paymentMethod:payment_method,
      user,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).send("Server Error");
  }
};
//order confirmation
const confirmOrder = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    const user = req.session.user;
    const userId = user._id;
    const { addressId, paymentMethod } = req.body;
    
    if (!addressId) {
      return res.status(400).json({ message: "Address is required" });
    }

    const address = await Address.findOne({ _id: addressId, userId: userId });
    if (!address) {
      return res.status(400).json({ message: "Invalid address" });
    }

    const paymentMethodEnum = paymentMethod;  // Use mapped or validated payment method
    if (!paymentMethodEnum) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const cart = await Cart.findOne({ userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let orderItems = [];
    let grandTotal = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;
      const quantity = cartItem.quantity;

      if (!product || !product.isListed || product.quantity < quantity || product.quantity === 0) {
        continue;  // Skip product if not available
      }

      const discountedPrice =
        product.price * (1 - (product.discount || 0) / 100);
      const subtotal = discountedPrice * quantity;

      orderItems.push({
        productId: product._id,
        quantity: quantity,
        price: discountedPrice,
        subtotal: subtotal,
      });

      product.quantity -= quantity;
      if (product.quantity === 0) {
        product.status = "Out of Stock";
      }
      await product.save();

      grandTotal += subtotal;
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ message: "No products are available" });
    }

    // Create a new order
    const newOrder = new Order({
      userId,
      addressId,
      items: orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        deliveryStatus: "Pending"
      })),
      grandTotal,
      paymentMethod: paymentMethodEnum,
      paymentStatus: paymentMethodEnum === "Cash on Delivery" ? "Pending" : "Initiated",
    });

    await newOrder.save();

    // Clear the cart immediately after creating the order
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    if (paymentMethodEnum !== "Cash on Delivery") {
      // Create Razorpay order for online payments
      const razorpayOrder = await razorpay.orders.create({
        amount: grandTotal * 100, // Razorpay expects amount in paise
        currency: "INR",
        receipt: newOrder.orderId,
        payment_capture: 1
      });

      // Update order with Razorpay details
      newOrder.razorpayOrderId = razorpayOrder.id;
      await newOrder.save();

      res.render("razorpayCheckout", { 
        user, 
        order: newOrder, 
        razorpayOrder,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      });
    } else {
      // For COD, show order placed page immediately
      const populatedOrder = await Order.findById(newOrder._id)
    .populate('items.productId')  // Populate product details
    .populate('addressId'); 
      res.render("orderPlaced", { user, order: populatedOrder });
    }
  } catch (error) {
    console.error("Error in confirmOrder:", error);
    res.status(500).json({ message: "Failed to place order", error: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const user = req.session.user;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentFailed } = req.query;

    let order;

    // Handle case where payment failed or modal was dismissed
    if (paymentFailed === "true") {
      order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { paymentStatus: "Failed" }, // Set payment status to "Failed"
        { new: true }
      ).populate('items.productId') // Populate product details
       .populate('addressId');      // Populate address details

      // Cart clearing logic (if applicable)
      await Cart.findOneAndUpdate({ userId: order.userId }, { $set: { items: [] } });

      return res.render("orderPlaced", { user, order }); // Render the orderPlaced page with order details
    }

    // If the payment was not failed, verify the payment signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // Payment is successful, update order with payment details
      order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { 
          paymentStatus: "Paid", // Set payment status to "Paid"
          razorpayPaymentId: razorpay_payment_id
        },
        { new: true }
      ).populate('items.productId') // Populate product details
       .populate('addressId');      // Populate address details

      // Clear the cart
      await Cart.findOneAndUpdate({ userId: order.userId }, { $set: { items: [] } });

      res.render("orderPlaced", { user, order }); // Render the orderPlaced page with order details
    } else {
      // Payment verification failed, set order status to "Failed"
      order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { paymentStatus: "Failed" }, // Set payment status to "Failed"
        { new: true }
      ).populate('items.productId') // Populate product details
       .populate('addressId');      // Populate address details

      res.render("orderPlaced", { user, order }); // Render the orderPlaced page with failed order status
    }
  } catch (error) {
    console.error("Error in verifyPayment:", error);
    res.status(500).json({ message: "Payment verification failed", error: error.message });
  }
};


//load cancel order
const loadCancelOrder = async (req, res) => {
  const user = req.session.user;
  const orderId = req.params.orderId;
  const productId = req.params.productId;

  const order = await Order.findById(orderId);
  const product = await Product.findById(productId);

  if (!order || !product) {
    return res.status(404).json({ message: "Order or product not found" });
  }
  const item = order.items.find((item) => item.productId.equals(productId));
  if (!item) {
    return res.status(404).json({ message: "Product not found in the order" });
  }
  res.render("cancelOrder", { order, product, user, item });
};

//cancel an order
const cancelOrder = async (req, res) => {
  try {
    const { orderId, productId, cancelReason } = req.params;

    const order = await Order.findById(orderId);
    const product = await Product.findById(productId);

    if (!order || !product) {
      return res.status(404).json({ message: "Order or product not found" });
    }

    const itemToCancel = order.items.find((item) =>
      item.productId.equals(productId)
    );

    if (!itemToCancel) {
      return res
        .status(404)
        .json({ message: "Product not found in the order" });
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

    res.redirect(`/my-orders/cancel-confirmation/${orderId}/${productId}`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
//canccellation confirmation
const loadCancelConfirmation = async (req, res) => {
  const { orderId, productId } = req.params;

  const order = await Order.findById(orderId);
  const product = await Product.findById(productId);

  if (!order || !product) {
    return res.status(404).json({ message: "Order or product not found" });
  }
  const canceledItem = order.items.find((item) =>
    item.productId.equals(productId)
  );

  if (!canceledItem) {
    return res.status(404).json({ message: "Item not found in the order" });
  }

  res.render("cancelConfirmation", {
    order,
    product,
    user: req.session.user,
    cancelReason: canceledItem.cancelReason,
  });
};
/* function mapPaymentMethod(method) {
  switch (method) {
    case "COD":
      return "Cash on Delivery";
    case "Credit Card":
    case "Debit Card":
    case "UPI":
    case "Net Banking":
      return method;
    default:
      return null;
  }
} */
module.exports = {
  loadCheckout,
  placeOrder,
  confirmOrder,
  loadCancelOrder,
  cancelOrder,
  loadCancelConfirmation,
  verifyPayment
};
