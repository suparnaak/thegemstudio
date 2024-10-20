//const { name } = require("ejs");
const mongoose = require("mongoose");
const { Schema } = mongoose;

const brandSchema = new Schema({
  brandName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  isListed: {
    type: Boolean,
    default: true,
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
});
const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand;
