const mongoose = require("mongoose");
const { Schema } = mongoose;

const addresSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  houseName: {
    type: String,
    required: true,
  },
  street: {
    type: String,
    required: true,
  },
  city: {
    required: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  zipcode: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
});
const Address = mongoose.model("Address", addresSchema);
module.exports = Address;
