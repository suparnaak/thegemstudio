const Product = require("../models/productsSchema");
const Cart = require("../models/cartSchema");
const fetchCartData = async (req, res, next) => {
  try {
    let totalPrice = 0;
    let itemCount = 0;
    let recentItems = [];

    const userId = req.session.user?._id;

    if (userId) {
      // Fetch the cart with populated product details
      const cart = await Cart.findOne({ userId }).populate({
        path: "items.product",
        model: "Product",
        select: "name finalPrice images", // Select finalPrice directly
      });

      if (cart && cart.items.length > 0) {
        // Fetch the 2 most recent items
        recentItems = cart.items.slice(-2);

        // Loop through cart items to calculate total item count
        cart.items.forEach((item) => {
          itemCount += item.quantity; // Increment item count by quantity
        });

        // Use cart's grandTotal field directly
        totalPrice = cart.grandTotal;
      }
    }

    // Always set res.locals to ensure no undefined values
    res.locals.recentItems = recentItems || []; // Ensure it's always an array
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
