const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const couponSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  min_order_price: {
    type: Number,
    required: true
  },
  discount_rs: {
    type: Number,
    required: true
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  usage_limit: {
    type: Number,
    required: true
  },
  used_count: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['inactive', 'active', 'expired', 'deleted'],
    default: "inactive" 
  },
  is_deleted: { 
    type: Boolean, 
    default: false }
}, {
  timestamps: true 
});

module.exports = mongoose.model('Coupon', couponSchema);
