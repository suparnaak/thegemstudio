const Product = require("../../models/productsSchema");
const Wishlist = require("../../models/wishlistSchema");
const Category = require("../../models/categorySchema");
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")
const Cart = require("../../models/cartSchema");
//ladd to wishlist
const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(STATUSCODES.NOT_FOUND).json({ message: MESSAGES.PRODUCT.NOT_FOUND });
    }
    if (product.quantity === 0) {
      return res.status(STATUSCODES.BAD_REQUEST).json({ message: MESSAGES.PRODUCT.OUT_OF_STOCK });
    }

    if (!product.isListed) {
      return res.status(STATUSCODES.BAD_REQUEST).json({ message: MESSAGES.PRODUCT.UNAVAILABLE });
    }
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [] });
    }
    if (wishlist.items.some((item) => item.product.toString() === productId)) {
      return res.status(STATUSCODES.OK).json({ message: MESSAGES.WISHLSIT.ALREADY });
    }
    wishlist.items.push({ product: productId });

    await wishlist.save();

    return res.status(STATUSCODES.OK).json({ message: MESSAGES.WISHLSIT.ADDED });
  } catch (error) {
    console.error(error);
    return res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
  }
};
//load wish list
const loadWishlist = async (req, res) => {
  try {
    const user = req.session.user;
    if (user) {
      const wishlist = await Wishlist.findOne({ userId: user._id }).populate(
        "items.product"
      );
      res.render("wishlist", {
        user: user,
        wishlist: wishlist ? wishlist.items : [],
      });
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    console.log("Wishlist page not found:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
  }
};
//remove from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId } = req.body;

    const wishlist = await Wishlist.findOne({ userId });

    if (wishlist) {
      wishlist.items = wishlist.items.filter(
        (item) => item.product.toString() !== productId
      );
      await wishlist.save();

      return res.json({ message: MESSAGES.WISHLSIT.REMOVED });
    } else {
      return res.status(STATUSCODES.NOT_FOUND).json({ message: MESSAGES.WISHLSIT.NOT_FOUND });
    }
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.GENERAL.SERVER_ERROR});
  }
};
//add to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId } = req.body;

    const product = await Product.findById(productId).populate("category");
    if (!product) {
      return res.status(STATUSCODES.NOT_FOUND).json({ message: MESSAGES.PRODUCT.NOT_FOUND });
    }

    const category = await Category.findById(product.category._id);
    if (!category) {
      return res.status(STATUSCODES.NOT_FOUND).json({ message: MESSAGES.CATEGORY.NOT_FOUND });
    }

    const originalPrice = product.price;
    const categoryDiscount = category.offer ? category.offer / 100 : 0;
    const priceAfterCategoryDiscount =
      originalPrice - originalPrice * categoryDiscount;
    const productDiscount = product.discount ? product.discount / 100 : 0;
    const finalPrice =
      priceAfterCategoryDiscount - priceAfterCategoryDiscount * productDiscount;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        grandTotal: 0,
      });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );
    if (existingItem) {
      return res.json({ message: MESSAGES.CART.EXISTS });
    }

    cart.items.push({
      product: product._id,
      quantity: 1,
      price: originalPrice,
      finalPrice: finalPrice,
    });

    cart.grandTotal += finalPrice;
    await cart.save();

    return res.json({ message: MESSAGES.CART.PRODUCT_ADDED });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    return res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

module.exports = {
  addToWishlist,
  loadWishlist,
  removeFromWishlist,
  addToCart,
};
