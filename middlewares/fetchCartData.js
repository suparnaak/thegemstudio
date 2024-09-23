const Product = require("../models/productsSchema");
const Cart = require("../models/cartSchema");

const fetchCartData = async (req, res, next) => {
    try {
        let totalPrice = 0;
        let itemCount = 0;
        let recentItems = [];

        const userId = req.session.user?._id;

        if (userId) {
            const cart = await Cart.findOne({ userId }).populate({
                path: 'items.product',
                model: 'Product',
                select: 'name price discount images'
            });

            if (cart && cart.items.length > 0) {
                recentItems = cart.items.slice(-2); // Get last two items added
                cart.items.forEach(item => {
                    const discountedPrice = item.product.price - item.product.discount;
                    item.subtotal = discountedPrice * item.quantity;
                    totalPrice += item.subtotal;
                    itemCount += item.quantity;
                });
            }
        }

        // Attach the cart data to the response locals
        res.locals.recentItems = recentItems; // Set recentItems here
        res.locals.totalPrice = totalPrice;
        res.locals.itemCount = itemCount;

        next();
    } catch (error) {
        console.error('Error fetching cart:', error);
        next(error);
    }
};

module.exports = {
    fetchCartData
};
