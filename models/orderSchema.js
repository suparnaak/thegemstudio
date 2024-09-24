const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      default: function () {
        return `OD${Date.now()}${Math.floor(100000 + Math.random() * 900000)}`;
      },
    },
    addressId: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        subtotal: {
          type: Number,
          required: true,
          default: function () {
            return this.quantity * this.price; // Adjusted to calculate without discount
          },
        },
        /*         status: {
          type: String,
          enum: ["Delivered", "Pending", "Returned", "Cancelled"],
          default: "Pending",
        }, */
        deliveryStatus: {
          type: String, // Added type property
          enum: ["Delivered", "Pending", "Cancelled", "Admin Cancelled"],
          default: "Pending",
        },
        cancelReason: {
          type: String,
          default: null,
        },
      },
    ],
    coupons: {
      type: String,
      default: null, // If a coupon is applied, store coupon code
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: [
        "Credit Card",
        "Debit Card",
        "Cash on Delivery",
        "UPI",
        "Net Banking",
      ],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Pending",
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt timestamps
  }
);

// Generate model from schema
const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
