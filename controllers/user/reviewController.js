const Order = require("../../models/orderSchema");
const Product = require("../../models/productsSchema");
const Review = require("../../models/reviewSchema");
const loadReview = async (req, res) => {
    try {
      const user = req.session.user;
      const productId = req.params.productId;
  
      if (user) {

        const order = await Order.findOne({
          userId: user._id,
          items: {
            $elemMatch: {
              productId: productId,
              deliveryStatus: "Delivered"
            }
          }
        });
        if (order) {
          const existingReview = await Review.findOne({
            userId: user._id,
            productId: productId
        });
          const product = await Product.findById(productId).populate('brand', 'brandName');
          if (product) {
            res.render("review", {
                user: user,
                product: product,
                brandName: product.brand.brandName,
                orderId:order._id,
                existingReview: existingReview
            });
          } else {
            res.status(404).render("page-404", { user: user });
          }
        } else {
          res.status(403).render("page-404", { user: user });
        }
      } else {
        res.redirect("/login");
      }
    } catch (error) {
      console.log("Error loading review page:", error);
      res.status(500).render("page-404", { user: user });
    }
  };
  const submitReview = async (req, res) => {
    try {
        const productId = req.params.productId; // Get productId from URL params
        const { rating, reviewText } = req.body;
        const user = req.session.user;

        // Input validation
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Please provide a valid rating between 1 and 5." });
        }

        if (!reviewText || reviewText.trim().length < 10) {
            return res.status(400).json({ message: "Review must be at least 10 characters long." });
        }

        // Check for existing review
        const existingReview = await Review.findOne({
            userId: user._id,
            productId: productId
        });

        if (existingReview) {
            return res.status(400).json({ message: "You have already submitted a review for this product." });
        }

        // Verify purchase and delivery
        const order = await Order.findOne({
            userId: user._id,
            'items.productId': productId,
            'items.deliveryStatus': 'Delivered'
        });

        if (!order) {
            return res.status(403).json({ message: "You can only review products you have purchased and received." });
        }

        // Create and save review
        const newReview = new Review({
            userId: user._id,
            productId: productId,
            rating: rating,
            reviewText: reviewText.trim()
        });

        await newReview.save();
        res.status(200).json({ message: "Review submitted successfully!" });
    } catch (error) {
        console.error("Error submitting review:", error);
        res.status(500).json({ message: "An error occurred while submitting your review." });
    }
};
  module.exports = {
    loadReview,
    submitReview
  }