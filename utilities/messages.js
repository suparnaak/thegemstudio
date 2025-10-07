
module.exports = Object.freeze({
  GENERAL: {
    SERVER_ERROR: 'Server error. Please try again later.',
    INVALID_REQUEST: 'Invalid request.',
    RESOURCE_NOT_FOUND: 'Requested resource not found.',
    REQUIRED:"All fields are required",
    NO_USER:"No user logged in",
    
  },

  AUTH: {
    UNAUTHORIZED: 'Authentication required.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    FORBIDDEN: 'You do not have permission to perform this action.',
    ADMIN_NOT_FOUND:'Admin Not Found',
    INVALID_OTP:"Invalid OTP, Please try again",
    NO_EMAIL:"Email not found in session",
    OTP_SEND:"OTP resend successfully" ,
    NO_USER:"User not found",
    BLOCKED:"Blocked by Admin",
    OTP_EXPIRED:"OTP expired or not found. Please request a new one.",
    OTP_MATCH:"OTP verified successfully",
    OTP_RESENT:"OTP resent successfully",
    SESSION_EXPIRED:"Session expired. Please request a password reset again.",
    PASSWORD_MISMATCH:"Passwords do not match",
    PWD_RESET:"Password reset successfully!",
    NO_SAME_PWD:'New password cannot be the same as the current password',
    PWD_SAVED:'Password changed successfully!',
    USER_SAVED:"Profile updated successfully",
  },

   BRAND: {
    NAME_DESC_REQ:"Brand name and description are required.",
    ALREADY_EXISTS:"Brand with this name already exists.",
    CREATED:"Brand added successfully!",
    
  },

  CATEGORY: {
    NAME_DESC_REQ:"Brand name and description are required.",
    ALREADY_EXISTS:"Category with this name already exists.",
    CREATED:"Brand added successfully!",
    INVALID:"Invalid Category Name",
    UPDATED:"Category updated successfully",
    NOT_FOUND:"Category not found",
  },
 PAYMENT: {
    PAYMENT_ERROR_COD:'Cannot retry payment for Cash On Delivery orders',
    VERIFY_FAILED:'Payment verification failed',
  },


  CART: {
    UNAUTHORIZED:'Please login to add items to cart',
    INVALID_QUANTITY:"Invalid quantity" ,
    NO_PRODUCT:"Product not found",
    NO_CATEGORY:"Category not found",
    PRODUCT_ADDED:"Product added to cart successfully",
    MIN:"Mininum 1 is required",
    MAX:"Maximum quantity per product is 5",
    NO_CART:"Cart not found",
    UPDATED:"Cart updated successfully",
    PRODUCT_REMOVED:"Product removed from cart successfully",
    EXISTS:"Product already in cart",
  },

  ORDER: {
    CREATED: 'Order placed successfully.',
    CART_EMPTY:"Your cart is empty. Add items before checking out.",
    NOT_AVAILABLE:"Some items are no longer available. Please review your cart.",
    ADDRESS_REQ:"Address is required",
    INVALID_PAYMENT:"Invalid payment method",
    NOT_FOUND: 'Order not found.',
    NO_PRODUCT:"Product not found in the order",
  },

  PRODUCT: {
    NOT_FOUND: 'Product not found.',
    OUT_OF_STOCK: 'Product is out of stock.',
    IMAGE_LIMIT:"Please upload at least 3 images.",
    CREATED:"Product has been added successfully",
    BLOCKED:"Product has been blocked successfully.",
    UNBLOCKED:"Product has been unblocked successfully.",
    UNAVAILABLE: "Product is not available",
  },

  COUPON: {
    INVALID: "Coupon code cannot be empty or spaces only",
    INVALID_NUMBER:"Price, discount, and usage limit must be positive values",
    INVALID_START_DATE:"Start date should not be before today",
    INVALID_END_DATE:"End date should not be before today or the start date",
    ALREADY_EXISTS:"Coupon code already exists",
    CREATED:"Coupon added successfully",
    DELETED:"Coupon deleted successfully",
  },

  

  WALLET: {
    INSUFFICIENT_BALANCE: 'Insufficient wallet balance.',
    TOPUP_SUCCESS: 'Wallet topped up successfully.'
  },
  ADDRESS: {
    NO_ADDRESS:"No addresses added. Add a new address to get started!",
    DENY_EDIT:"You do not have permission to edit this address",
    DELETED:"Address deleted successfully",
  },
  REVIEW:{
    VALID_RANGE:"Please provide a valid rating between 1 and 5.",
    VALID_LENGTH:"Review must be at least 10 characters long.",
    ALREADY_SUBMITED:"You have already submitted a review for this product.",
    FORBIDDEN:"You can only review products you have purchased and received.",
    CREATED:"Review submitted successfully!",
  },
  WISHLSIT:{
    ALREADY:"Already in wishlist",
    ADDED:"Added to wishlist",
    REMOVED:"Product removed from wishlist",
    NOT_FOUND:"Wishlist not found",
  }
});
