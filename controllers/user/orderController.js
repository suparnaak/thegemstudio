const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productsSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");

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
     /*  unavailableProducts, */
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

    const paymentMethodEnum = mapPaymentMethod(paymentMethod);
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
        // Skip this product if it's not listed or out of stock
        continue;
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

    const newOrder = new Order({
      userId,
      addressId,
      items: orderItems,
      grandTotal,
      paymentMethod: paymentMethodEnum,
      paymentStatus:
        paymentMethodEnum === "Cash on Delivery" ? "Pending" : "Paid",
    });

    await newOrder.save();

    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    const completedOrder = await Order.findById(newOrder._id)
      .populate("userId", "name email")
      .populate("addressId")
      .populate("items.productId", "name");

    res.render("orderPlaced", { user, order: completedOrder });
  } catch (error) {
    console.error("Error in confirmOrder:", error);
    res
      .status(500)
      .json({ message: "Failed to place order", error: error.message });
  }
};
function mapPaymentMethod(method) {
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
}
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

module.exports = {
  loadCheckout,
  placeOrder,
  confirmOrder,
  loadCancelOrder,
  cancelOrder,
  loadCancelConfirmation,
};
