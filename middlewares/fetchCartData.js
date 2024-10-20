/* const Product = require("../models/productsSchema"); */
const Cart = require("../models/cartSchema");
const fetchCartData = async (req, res, next) => {
  try {
    let totalPrice = 0;
    let itemCount = 0;
    let recentItems = [];
    const userId = req.session.user?._id;
    if (userId) {
      const cart = await Cart.findOne({ userId }).populate({
        path: "items.product",
        model: "Product",
        select: "name finalPrice images",
      });

      if (cart && cart.items.length > 0) {
        recentItems = cart.items.slice(-2);

        cart.items.forEach((item) => {
          itemCount += item.quantity;
        });

        totalPrice = cart.grandTotal;
      }
    }

    res.locals.recentItems = recentItems || [];
    res.locals.totalPrice = totalPrice || 0;
    res.locals.itemCount = itemCount || 0;

    next();
  } catch (error) {
    console.error("Error fetching cart:", error);
    next(error);
  }
};

module.exports = {
  fetchCartData,
};
