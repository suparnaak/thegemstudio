const Order = require("../../models/orderSchema");
const Product = require("../../models/productsSchema");
const Review = require("../../models/reviewSchema");
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")
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
            res.status(STATUSCODES.NOT_FOUND).render("page-404", { user: user });
          }
        } else {
          res.status(STATUSCODES.FORBIDDEN).render("page-404", { user: user });
        }
      } else {
        res.redirect("/login");
      }
    } catch (error) {
      console.log("Error loading review page:", error);
      res.status(STATUSCODES.INTERNAL_SERVER_ERROR).render("page-404", { user: user });
    }
  };
  const submitReview = async (req, res) => {
    try {
        const productId = req.params.productId; 
        const { rating, reviewText } = req.body;
        const user = req.session.user;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(STATUSCODES.BAD_REQUEST).json({ message: MESSAGES.REVIEW.VALID_RANGE });
        }

        if (!reviewText || reviewText.trim().length < 10) {
            return res.status(STATUSCODES.BAD_REQUEST).json({ message: MESSAGES.REVIEW.VALID_LENGTH  });
        }

        const existingReview = await Review.findOne({
            userId: user._id,
            productId: productId
        });

        if (existingReview) {
            return res.status(STATUSCODES.BAD_REQUEST).json({ message: MESSAGES.REVIEW.ALREADY_SUBMITED });
        }

        const order = await Order.findOne({
            userId: user._id,
            'items.productId': productId,
            'items.deliveryStatus': 'Delivered'
        });

        if (!order) {
            return res.status(STATUSCODES.FORBIDDEN).json({ message: MESSAGES.REVIEW.FORBIDDEN });
        }

        const newReview = new Review({
            userId: user._id,
            productId: productId,
            rating: rating,
            reviewText: reviewText.trim()
        });

        await newReview.save();
        res.status(STATUSCODES.OK).json({ message: MESSAGES.REVIEW.CREATED });
    } catch (error) {
        console.error("Error submitting review:", error);
        res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
    }
};
  module.exports = {
    loadReview,
    submitReview
  }