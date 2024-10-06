const Product = require("../../models/productsSchema");
const Order = require("../../models/orderSchema");

const listOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Number of orders per page
    const skip = (page - 1) * limit;

    // Fetch orders with pagination and populate necessary fields (excluding addressId)
    const orders = await Order.find({})
      .populate('userId', 'name email') // Populate user details (name, email)
      .populate('items.productId', 'name price discount') // Populate product details for items
      .skip(skip)
      .limit(limit)
      .sort({ orderDate: -1 });

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    // Render the view and pass the orders and pagination data
    res.render('orders-list', {
      orders: orders || [], // Ensure orders is always an array
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log('Error listing orders:', error);
    // Render the view with an empty orders array in case of an error
    res.render('orders-list', {
      orders: [],
      currentPage: 1,
      totalPages: 1,
      error: 'An error occurred while fetching orders.',
    });
  }
};

const listOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Fetch the order details with user and product information, but not addressId
    const order = await Order.findById(orderId)
      .populate('userId', 'name email') // Populate user details
      .populate('items.productId', 'name price discount'); // Populate product details

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Render the order-details page, passing the order object
    res.render('order-details', { order });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).send('An error occurred while fetching order details');
  }
};
const updateOrderStatus = async (req, res) => {
  try {
      const { orderId, paymentStatus, productId, newStatus } = req.body;

      const order = await Order.findById(orderId);
      if (!order) {
          return res.status(404).json({ message: 'Order not found' });
      }

      // Handle payment status update
      if (paymentStatus) {
          order.paymentStatus = paymentStatus;
          await order.save();
          return res.json({ message: 'Payment status updated successfully!' });
      }

      // Handle delivery status update
      if (productId && newStatus) {
          const item = order.items.find(item => item.productId.equals(productId));
          if (!item) {
              return res.status(404).json({ message: 'Product not found in the order' });
          }

          // Validate status transitions
          if (
              (item.deliveryStatus === 'Pending' && ['Delivered', 'Admin Cancelled'].includes(newStatus)) ||
              (item.deliveryStatus === 'Return Pending' && newStatus === 'Returned')
          ) {
              item.deliveryStatus = newStatus;
              await order.save();
              return res.json({ message: 'Delivery status updated successfully!' });
          } else {
              return res.status(400).json({ message: 'Invalid status transition' });
          }
      }

      return res.status(400).json({ message: 'Invalid request' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
  }
};
  module.exports = {
    listOrders,
    listOrderDetails,
    updateOrderStatus
  }