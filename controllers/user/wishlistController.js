const Product = require("../../models/productsSchema");
const Wishlist = require("../../models/wishlistSchema");
const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body; // The product ID sent from the frontend
        const userId = req.session.user; // Assuming user is logged in and session is available

        // Fetch the product details
        const product = await Product.findById(productId);

        // Check if the product exists
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Check if the product is out of stock
        if (product.quantity === 0) {
            return res.status(400).json({ message: 'Out of stock' });
        }

        if (!product.isListed) {
            return res.status(400).json({ message: 'Product is not available' });
        }
        // Check if the product is already in the user's wishlist
        const existingWishlistItem = await Wishlist.findOne({ userId, productId });
        if (existingWishlistItem) {
            return res.status(200).json({ message: 'Already in wishlist' });
        }

        // Add the product to the wishlist
        const wishlistItem = new Wishlist({ userId, productId });
        await wishlistItem.save();

        // Success response
        return res.status(200).json({ message: 'Added to wishlist' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
module.exports = {
    addToWishlist
}