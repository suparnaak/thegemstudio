const Product = require("../../models/productsSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
//const mongoose = require('mongoose');

// Add to cart
const addToCart = async (req, res) => {
  try {
    const MAX_QUANTITY_PER_PRODUCT = 5;
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    const quantityToAdd = parseInt(quantity, 10);
    if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingCartItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    let newQuantity;
    if (existingCartItem) {
      newQuantity = existingCartItem.quantity + quantityToAdd;
    } else {
      newQuantity = quantityToAdd;
    }

    if (product.quantity < newQuantity) {
      return res.status(400).json({
        error: `Not enough stock available. Available: ${product.quantity}, Requested: ${newQuantity}`,
      });
    }

    if (newQuantity > MAX_QUANTITY_PER_PRODUCT) {
      return res.status(400).json({
        error: `Cannot add ${quantityToAdd} more. Maximum quantity per product is ${MAX_QUANTITY_PER_PRODUCT}. Current quantity in cart: ${
          existingCartItem ? existingCartItem.quantity : 0
        }`,
      });
    }

    if (existingCartItem) {
      existingCartItem.quantity = newQuantity;
    } else {
      cart.items.push({
        product: productId,
        quantity: newQuantity,
        price: product.price,
      });
    }

    await cart.save();
    res
      .status(200)
      .json({ success: true, message: "Product added to cart successfully" });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

//view cart
const loadCart = async (req, res) => {
  try {
    const userId = req.session.user._id; // Get the logged-in user ID
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.product",
      model: "Product",
      select: "name price discount images",
    });

    if (!cart || cart.items.length === 0) {
      return res.render("cart", {
        cart: null,
        totalPrice: 0,
        user: req.session.user,
      });
    }

    cart.items.forEach((item) => {
      const discountedPrice = item.product.price - item.product.discount;
      item.subtotal = discountedPrice * item.quantity;
    });

    const totalPrice = cart.items.reduce(
      (total, item) => total + item.subtotal,
      0
    );

    res.render("cart", {
      cart: cart.items,
      totalPrice,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).send("Server error");
  }
};
const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    console.log("Updating cart:", { productId, quantity, userId });

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    if (quantity < 1) {
      return res
        .status(400)
        .json({ success: false, error: "Quantity must be at least 1" });
    }

    if (quantity > product.quantity) {
      return res.status(400).json({
        success: false,
        error: "Out of stock. Only " + product.quantity + " items available",
      });
    }

    if (quantity > 5) {
      return res
        .status(400)
        .json({ success: false, error: "Maximum quantity per product is 5" });
    }

    let cart = await Cart.findOne({ userId }).populate("items.product");
    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found" });
    }

    const cartItemIndex = cart.items.findIndex(
      (item) => item.product._id.toString() === productId
    );
    if (cartItemIndex > -1) {
      cart.items[cartItemIndex].quantity = quantity;
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Product not found in cart" });
    }

    await cart.save();

    console.log("Cart updated successfully");
    res.json({
      success: true,
      message: "Cart updated successfully",
      cart: cart.items,
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ success: false, error: "Error updating cart" });
  }
};
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;

    const userId = req.session.user;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found" });
    }

    const cartItemIndex = cart.items.findIndex((item) => {
      return item.product && item.product.toString() === productId.toString();
    });

    if (cartItemIndex === -1) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found in cart" });
    }

    cart.items.splice(cartItemIndex, 1);
    await cart.save();
    res.json({
      success: true,
      message: "Product removed from cart successfully",
      cart: cart.items,
    });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = {
  loadCart,
  addToCart,
  updateCartItem,
  removeFromCart,
};
