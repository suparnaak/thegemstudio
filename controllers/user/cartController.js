const Product = require("../../models/productsSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema");
const Category = require("../../models/categorySchema");
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

    // Fetch product and its category
    const product = await Product.findById(productId).populate("category");
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const category = await Category.findById(product.category._id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Get original price (unit price)
    const originalPrice = product.price;

    // Calculate category discount
    const categoryDiscount = category.offer ? (category.offer / 100) : 0;
    const priceAfterCategoryDiscount = originalPrice - (originalPrice * categoryDiscount);

    // Calculate product discount
    const productDiscount = product.discount ? (product.discount / 100) : 0;
    const finalPrice = priceAfterCategoryDiscount - (priceAfterCategoryDiscount * productDiscount);

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if product is already in the cart
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

    // Update cart item or add new item
    if (existingCartItem) {
      existingCartItem.quantity = newQuantity;
      existingCartItem.price = originalPrice; // Keep original unit price
      existingCartItem.finalPrice = finalPrice; // Store the final price after applying discounts
    } else {
      cart.items.push({
        product: productId,
        quantity: newQuantity,
        price: originalPrice, // Store original unit price
        finalPrice: finalPrice, // Store final price after discounts
      });
    }

    // Calculate grand total
    let grandTotal = 0;
    cart.items.forEach((item) => {
      grandTotal += item.finalPrice * item.quantity;
    });

    cart.grandTotal = grandTotal; // Add grand total to the cart

    await cart.save();
    res
      .status(200)
      .json({ success: true, message: "Product added to cart successfully", grandTotal });
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
      select: "name images price discount category", // Include the necessary fields
      populate: {
        path: "category", // Populate the category
        model: "Category",
        select: "offer", // Only include the offer field
      },
    });

    
    if (!cart || cart.items.length === 0) {
      // If the cart is empty, return with an empty coupons array
      return res.render("cart", {
        cart: null,
        grandTotal: 0,
        user: req.session.user
       
      });
    }

    // Access grandTotal from the cart
    const grandTotal = cart.grandTotal;

    console.log(cart); // For debugging purposes

    res.render("cart", {
      cart: cart.items, // This includes populated product details
      grandTotal: grandTotal, // Pass the grand total from the cart schema
      user: req.session.user
      
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
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    if (quantity < 1) {
      return res.status(400).json({ success: false, error: "Quantity must be at least 1" });
    }

    if (quantity > product.quantity) {
      return res.status(400).json({
        success: false,
        error: "Out of stock. Only " + product.quantity + " items available",
      });
    }

    if (quantity > 5) {
      return res.status(400).json({ success: false, error: "Maximum quantity per product is 5" });
    }

    let cart = await Cart.findOne({ userId }).populate("items.product");
    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found" });
    }

    const cartItemIndex = cart.items.findIndex(
      (item) => item.product._id.toString() === productId
    );
    
    if (cartItemIndex > -1) {
      // Update the quantity
      cart.items[cartItemIndex].quantity = quantity;
      await cart.save();
      let grandTotal = 0;
      cart.items.forEach((item) => {
        grandTotal += item.finalPrice * item.quantity;
      });
      
      // Assign grandTotal to the cart
      cart.grandTotal = grandTotal;
    } else {
      return res.status(404).json({ success: false, error: "Product not found in cart" });
    }

    await cart.save();

    console.log("Cart updated successfully");
    res.json({
      success: true,
      message: "Cart updated successfully",
      cart: cart.items,
      grandTotal: cart.grandTotal, // Return the updated grandTotal
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

    // Find the cart for the user
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found" });
    }

    // Find the index of the product in the cart
    const cartItemIndex = cart.items.findIndex((item) => {
      return item.product && item.product.toString() === productId.toString();
    });

    // If product is not found in the cart
    if (cartItemIndex === -1) {
      return res.status(404).json({ success: false, error: "Product not found in cart" });
    }

    // Remove the product from the cart
    cart.items.splice(cartItemIndex, 1);

    // Recalculate the grand total
    let grandTotal = 0;
    cart.items.forEach(item => {
      grandTotal += item.finalPrice * item.quantity;
    });

    // Update the grand total in the cart
    cart.grandTotal = grandTotal;

    // Save the updated cart
    await cart.save();

    // Return the updated cart and grand total
    res.json({
      success: true,
      message: "Product removed from cart successfully",
      cart: cart.items,
      grandTotal: cart.grandTotal,  // Send updated grand total
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
