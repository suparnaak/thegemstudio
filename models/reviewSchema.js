const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema({
  userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',  
      required: true
  },
  productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',  
      required: true
  },
  rating: {
      type: Number,  
      min: 1,
      max: 5,
      required: true
  },
  reviewText: {
      type: String,  
      required: true,
      minlength: 10
  },
  createdAt: {
      type: Date,
      default: Date.now  
  }
});

const Review = mongoose.model("Review", reviewSchema);
module.exports = Review;