const Product = require("../../models/productsSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema");
const Category = require("../../models/categorySchema");
// Add to cart
const addToCart = async (req, res) => {
  try {
    const MAX_QUANTITY_PER_PRODUCT = 5;
    const { productId, quantity } = req.body;
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ error: 'Please login to add items to cart' });
    }
    const quantityToAdd = parseInt(quantity, 10);
    if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }
    const product = await Product.findById(productId).populate("category");
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const category = await Category.findById(product.category._id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    const originalPrice = product.price;
    const categoryDiscount = category.offer ? category.offer / 100 : 0;
    const productDiscount = product.discount ? product.discount / 100 : 0;

    // Use the higher discount value between category and product
    const highestDiscount = Math.max(categoryDiscount, productDiscount);
    const finalPrice = originalPrice - originalPrice * highestDiscount;

    // Find or create the user's cart
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
    // Fetch updated cart data for header
    const updatedCart = await Cart.findOne({ userId }).populate({
      path: 'items.product',
      select: 'name images'
    }).exec();

    // Get recent items for header
    const recentItems = updatedCart.items.slice(-2);

    res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      headerData: {
        totalPrice: updatedCart.grandTotal,
        recentItems: recentItems
      }
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
// Load cart
const loadCart = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.product",
      model: "Product",
      select: "name images price discount quantity isListed",
      populate: {
        path: "category",
        model: "Category",
        select: "offer",
      },
    });

    console.log("Initial cart items:", cart ? cart.items.length : 0);
    console.log("Initial grandTotal in database:", cart ? cart.grandTotal : 0);
    const unavailableProducts = [];
    if (!cart || cart.items.length === 0) {
      console.log("Cart is empty");
      return res.render("cart", {
        cart: null,
        grandTotal: 0,
        unavailableProducts,
        user: req.session.user,
      });
    }

    const cartItems = [];
    
    let newGrandTotal = 0;

    // Process each item in the cart
    for (let item of cart.items) {
      const product = item.product;
      
      console.log(`Processing product: ${product ? product.name : 'Unknown'}`);
      console.log(`Product details: isListed=${product?.isListed}, quantity=${product?.quantity}, requested=${item.quantity}`);

      if (!product || !product.isListed || typeof product.quantity !== 'number' || product.quantity < item.quantity) {
        console.log(`Adding to unavailable products: ${product?.name || 'Unknown Product'}`);
        unavailableProducts.push({
          id: product ? product._id : null,
          name: product ? product.name : "Unknown Product",
          images: product ? product.images : [],
          status: !product
            ? "Product not found"
            : !product.isListed
            ? "Blocked by Admin"
            : "Out of Stock",
        });
      } else {
        const category = product.category;
        const originalPrice = product.price;
        const categoryDiscount = category && category.offer ? category.offer / 100 : 0;
        const productDiscount = product.discount ? product.discount / 100 : 0;
        const highestDiscount = Math.max(categoryDiscount, productDiscount);
        const finalPrice = originalPrice - originalPrice * highestDiscount;
        const itemTotal = finalPrice * item.quantity;

        console.log(`Valid product: ${product.name}, Final price: ${finalPrice}, Quantity: ${item.quantity}, Item total: ${itemTotal}`);
        
        newGrandTotal += itemTotal;
        
        cartItems.push({
          product: product,
          quantity: item.quantity,
          finalPrice: finalPrice,
          appliedDiscountPercent: (highestDiscount * 100).toFixed(2),
        });
      }
    }

    // Update cart.items to remove unavailable products
    const originalItemsCount = cart.items.length;
    cart.items = cart.items.filter(item => {
      const product = item.product;
      return product && product.isListed && typeof product.quantity === 'number' && product.quantity >= item.quantity;
    });

    console.log(`Removed ${originalItemsCount - cart.items.length} unavailable items from cart`);
    console.log(`New grand total: ${newGrandTotal}`);

    // Update the cart's grandTotal in the database
    cart.grandTotal = newGrandTotal;

    // Only save if the cart has changed
    if (originalItemsCount !== cart.items.length || cart.grandTotal !== newGrandTotal) {
      console.log("Saving updated cart with new grandTotal:", newGrandTotal);
      await cart.save();
    }

    res.render("cart", {
      cart: cartItems,
      grandTotal: newGrandTotal,
      unavailableProducts: unavailableProducts,
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
      return res.status(400).json({
        success: false,
        error: "Mininum 1 is required",
      });
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
      await cart.save();
      let grandTotal = 0;
      cart.items.forEach((item) => {
        grandTotal += item.finalPrice * item.quantity;
      });

      cart.grandTotal = grandTotal;
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Product not found in cart" });
    }

    await cart.save();
    const recentItems = cart.items.slice(-2);
    console.log("Cart updated successfully");
    res.json({
      success: true,
      message: "Cart updated successfully",
      cart: cart.items,
      grandTotal: cart.grandTotal,
      recentItems: recentItems
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

    // Step 1: Fetch the cart without populating
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found" });
    }

    const cartItemIndex = cart.items.findIndex((item) => {
      return item.product && item.product.toString() === productId.toString();
    });

    if (cartItemIndex === -1) {
      return res.status(404).json({ success: false, error: "Product not found in cart" });
    }

    // Step 2: Remove the item from the cart
    cart.items.splice(cartItemIndex, 1);

    let grandTotal = 0;
    cart.items.forEach((item) => {
      grandTotal += item.finalPrice * item.quantity;
    });

    cart.grandTotal = grandTotal;

    await cart.save();
    const updatedCart = await Cart.findOne({ userId }).populate('items.product');
    const recentItems = updatedCart.items.slice(-2);
    res.json({
      success: true,
      message: "Product removed from cart successfully",
      cart: updatedCart.items,
      grandTotal: updatedCart.grandTotal,
      recentItems: recentItems
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