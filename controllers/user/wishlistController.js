const Product = require("../../models/productsSchema");
const Wishlist = require("../../models/wishlistSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");

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

        // Check if the user's wishlist exists
        let wishlist = await Wishlist.findOne({ userId });

        // If wishlist does not exist, create a new one
        if (!wishlist) {
            wishlist = new Wishlist({ userId, items: [] });
        }

        // Check if the product is already in the user's wishlist
        if (wishlist.items.some(item => item.product.toString() === productId)) {
            return res.status(200).json({ message: 'Already in wishlist' });
        }

        // Add the productId to the items array as an object
        wishlist.items.push({ product: productId });
        
        // Save the updated wishlist
        await wishlist.save();

        // Success response
        return res.status(200).json({ message: 'Added to wishlist' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
//load wish list
const loadWishlist = async (req, res) => {
    try {
        const user = req.session.user;
        if (user) {
            // Fetch the wishlist for the user
            const wishlist = await Wishlist.findOne({ userId: user._id }).populate('items.product');
            res.render("wishlist", { user: user, wishlist: wishlist ? wishlist.items : [] });
        } else {
            res.redirect('/login'); // Redirect to login if not authenticated
        }
    } catch (error) {
        console.log("Wishlist page not found:", error);
        res.status(500).send("Server Error");
    }
};
const removeFromWishlist =async (req, res) => {
    try {
        const userId = req.session.user._id; // Assuming you store user data in the session
        const { productId } = req.body;

        // Find the user's wishlist
        const wishlist = await Wishlist.findOne({ userId });

        if (wishlist) {
            // Remove the product from the wishlist
            wishlist.items = wishlist.items.filter(item => item.product.toString() !== productId);
            await wishlist.save();
            
            return res.json({ message: 'Product removed from wishlist' });
        } else {
            return res.status(404).json({ message: 'Wishlist not found' });
        }
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ message: 'Server error' });
    }
}
//add to cart
const addToCart = async (req, res) => {
    try {
        const userId = req.session.user._id; // Assume user is logged in and stored in session
        const { productId } = req.body;

        // Find the product details
        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const category = await Category.findById(product.category._id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Calculate the final price with discounts
        const originalPrice = product.price;
        const categoryDiscount = category.offer ? (category.offer / 100) : 0;
        const priceAfterCategoryDiscount = originalPrice - (originalPrice * categoryDiscount);
        const productDiscount = product.discount ? (product.discount / 100) : 0;
        const finalPrice = priceAfterCategoryDiscount - (priceAfterCategoryDiscount * productDiscount);

        // Check if the cart exists for the user
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            // Create a new cart if none exists
            cart = new Cart({
                userId,
                items: [],
                grandTotal: 0,
            });
        }

        // Check if the product is already in the cart
        const existingItem = cart.items.find(item => item.product.toString() === productId);
        if (existingItem) {
            return res.json({ message: 'Product already in cart' });
        }

        // Add the new product to the cart
        cart.items.push({
            product: product._id,
            quantity: 1, // From wishlist, quantity is always 1
            price: originalPrice,
            finalPrice: finalPrice,
        });

        // Update the cart's grand total
        cart.grandTotal += finalPrice;
        await cart.save();

        return res.json({ message: 'Product added to cart' });
    } catch (error) {
        console.error('Error adding product to cart:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};


module.exports = {
    addToWishlist,
    loadWishlist,
    removeFromWishlist,
    addToCart
};