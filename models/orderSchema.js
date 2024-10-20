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
    invoiceNumber: {
      type: String,
      unique: true,
      required: true
    },
    address: {
      name: { type: String, required: true },
      houseName: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true },
      zipcode: { type: String, required: true },
      mobile: { type: String, required: true },
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
            return this.quantity * this.price; 
          },
        },
       
        deliveryStatus: {
          type: String, 
          enum: ["Pending",
    "Shipped",
    "On Transit",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
    "Admin Cancelled",
    "Return Pending",
    "Returned"],
          default: "Pending",
        },
        deliveryDate: {
          type: Date,  // Adding the delivery date for each product
          default: null, // Initially null, can be updated when product is delivered
        },
        
        cancelReason: {
          type: String,
          default: null,
        },
      },
    ],
    coupons: {
      type: String,
      default: null, 
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending","Initiated","Failed"],
      default: "Pending",
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    }
  },
  
  {
    timestamps: true, 
  }
);


const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
