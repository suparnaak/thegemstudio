const Product = require("../../models/productsSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema");
const Category = require("../../models/categorySchema");
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")
// Add to cart
const addToCart = async (req, res) => {
  try {
    const MAX_QUANTITY_PER_PRODUCT = 5;
    const { productId, quantity } = req.body;
    const userId = req.session.user;
    if (!userId) {
      return res.status(STATUSCODES.UNAUTHORIZED).json({ error: MESSAGES.CART.UNAUTHORIZED });
    }
    const quantityToAdd = parseInt(quantity, 10);
    if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
      return res.status(STATUSCODES.BAD_REQUEST).json({ error: MESSAGES.CART.INVALID_QUANTITY});
    }
    const product = await Product.findById(productId).populate("category");
    if (!product) {
      return res.status(STATUSCODES.NOT_FOUND).json({ error: MESSAGES.CART.NO_PRODUCT });
    }

    const category = await Category.findById(product.category._id);
    if (!category) {
      return res.status(STATUSCODES.NOT_FOUND).json({ error: MESSAGES.CART.NO_CATEGORY });
    }
    const originalPrice = product.price;
    const categoryDiscount = category.offer ? category.offer / 100 : 0;
    const productDiscount = product.discount ? product.discount / 100 : 0;

    const highestDiscount = Math.max(categoryDiscount, productDiscount);
    const finalPrice = originalPrice - originalPrice * highestDiscount;

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
      return res.status(STATUSCODES.BAD_REQUEST).json({
        error: `Not enough stock available. Available: ${product.quantity}, Requested: ${newQuantity}`,
      });
    }

    if (newQuantity > MAX_QUANTITY_PER_PRODUCT) {
      return res.status(STATUSCODES.BAD_REQUEST).json({
        error: `Cannot add ${quantityToAdd} more. Maximum quantity per product is ${MAX_QUANTITY_PER_PRODUCT}. Current quantity in cart: ${
          existingCartItem ? existingCartItem.quantity : 0
        }`,
      });
    }

    if (existingCartItem) {
      existingCartItem.quantity = newQuantity;
      existingCartItem.price = originalPrice; 
      existingCartItem.finalPrice = finalPrice; 
    } else {
      cart.items.push({
        product: productId,
        quantity: newQuantity,
        price: originalPrice,
        finalPrice: finalPrice, 
      });
    }

    let grandTotal = 0;
    cart.items.forEach((item) => {
      grandTotal += item.finalPrice * item.quantity;
    });

    cart.grandTotal = grandTotal; 

    await cart.save();
    const updatedCart = await Cart.findOne({ userId }).populate({
      path: 'items.product',
      select: 'name images'
    }).exec();

    const recentItems = updatedCart.items.slice(-2);

    res.status(STATUSCODES.OK).json({
      success: true,
      message: MESSAGES.CART.PRODUCT_ADDED,
      headerData: {
        totalPrice: updatedCart.grandTotal,
        recentItems: recentItems
      }
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.GENERAL.SERVER_ERROR });
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

    const unavailableProducts = [];
    if (!cart || cart.items.length === 0) {
      return res.render("cart", {
        cart: null,
        grandTotal: 0,
        unavailableProducts,
        user: req.session.user,
      });
    }

    const cartItems = [];
    
    let newGrandTotal = 0;

    for (let item of cart.items) {
      const product = item.product;
      
      if (!product || !product.isListed || typeof product.quantity !== 'number' || product.quantity < item.quantity) {
        
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
           
        newGrandTotal += itemTotal;
        
        cartItems.push({
          product: product,
          quantity: item.quantity,
          finalPrice: finalPrice,
          appliedDiscountPercent: (highestDiscount * 100).toFixed(2),
        });
      }
    }

    const originalItemsCount = cart.items.length;
    cart.items = cart.items.filter(item => {
      const product = item.product;
      return product && product.isListed && typeof product.quantity === 'number' && product.quantity >= item.quantity;
    });

    cart.grandTotal = newGrandTotal;

   
    if (originalItemsCount !== cart.items.length || cart.grandTotal !== newGrandTotal) {
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
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;


    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(STATUSCODES.NOT_FOUND)
        .json({ success: false, error: MESSAGES.CART.NO_PRODUCT });
    }

    if (quantity < 1) {
      return res.status(STATUSCODES.BAD_REQUEST).json({
        success: false,
        error: MESSAGES.CART.MIN,
      });
    }

    if (quantity > product.quantity) {
      return res.status(STATUSCODES.BAD_REQUEST).json({
        success: false,
        error: "Out of stock. Only " + product.quantity + " items available",
      });
    }

    if (quantity > 5) {
      return res
        .status(STATUSCODES.BAD_REQUEST)
        .json({ success: false, error: MESSAGES.CART.MAX });
    }

    let cart = await Cart.findOne({ userId }).populate("items.product");
    if (!cart) {
      return res.status(STATUSCODES.NOT_FOUND).json({ success: false, error: MESSAGES.CART.NO_CART });
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
        .status(STATUSCODES.NOT_FOUND)
        .json({ success: false, error: MESSAGES.CART.NO_PRODUCT });
    }

    await cart.save();
    const recentItems = cart.items.slice(-2);
    console.log("Cart updated successfully");
    res.json({
      success: true,
      message: MESSAGES.CART.UPDATED,
      cart: cart.items,
      grandTotal: cart.grandTotal,
      recentItems: recentItems
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ success: false, error: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(STATUSCODES.NOT_FOUND).json({ success: false, error: MESSAGES.CART.NO_CART });
    }

    const cartItemIndex = cart.items.findIndex((item) => {
      return item.product && item.product.toString() === productId.toString();
    });

    if (cartItemIndex === -1) {
      return res.status(STATUSCODES.NOT_FOUND).json({ success: false, error: MESSAGES.CART.NO_PRODUCT });
    }

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
      message: MESSAGES.CART.PRODUCT_REMOVED,
      cart: updatedCart.items,
      grandTotal: updatedCart.grandTotal,
      recentItems: recentItems
    });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ success: false, error: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

module.exports = {
  loadCart,
  addToCart,
  updateCartItem,
  removeFromCart,
};