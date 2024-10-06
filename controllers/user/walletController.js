const Wallet = require("../../models/walletSchema");
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const loadWallet = async (req, res) => {
  try {
      const user = req.session.user;
      const userId = user._id;

      // Get page number from query, default to 1 if not provided
      const page = parseInt(req.query.page) || 1;
      const limit = 5; // Number of transactions per page
      const offset = (page - 1) * limit; // Calculate offset

      if (user) {
          let wallet = await Wallet.findOne({ userId });

          // If no wallet found, create one with an initial balance of 0
          if (!wallet) {
              wallet = new Wallet({
                  userId: userId,
                  balance: 0,
                  transactions: [],
              });
              await wallet.save();
          }

          // Sort transactions by date (newest first)
          const sortedTransactions = wallet.transactions.sort((a, b) => {
              return new Date(b.date) - new Date(a.date); // Descending order
          });

          // Fetch transactions for the current page
          const transactions = sortedTransactions.slice(offset, offset + limit);
          const totalTransactions = sortedTransactions.length;
          const totalPages = Math.ceil(totalTransactions / limit);

          // Render the wallet page with pagination data
          res.render("wallet", { 
              user: user, 
              balance: wallet.balance || 0,
              transactions: transactions,
              currentPage: page,
              totalPages: totalPages,
              razorpayKey: process.env.RAZORPAY_KEY_ID  // This matches your env variable
          });
      } else {
          res.redirect('/login');  // Redirect if no user in session
      }
  } catch (error) {
      console.error("Error loading wallet:", error);
      res.status(500).render("error", { message: "Error loading wallet" });
  }
};


const addMoneyToWallet = async (req, res) => {
    try {
        const { amount } = req.body;
        const user = req.session.user._id;

        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency: "INR",
            receipt: `wallet_recharge_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json({ order });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ error: "Could not create order" });
    }
};

const verifyWalletPayment = async (req, res) => {
  try {
      const { payment, order } = req.body;
      const user = req.session.user;
      
      if (!user) {
          return res.status(401).json({ error: "User not logged in" });
      }

      const userId = user._id;

      // Verify signature
      const text = `${order.id}|${payment.razorpay_payment_id}`;
      const signature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(text)
          .digest('hex');

      if (signature === payment.razorpay_signature) {
          // Payment is verified, update wallet
          const wallet = await Wallet.findOne({ userId });
          if (!wallet) {
              return res.status(404).json({ error: "Wallet not found" });
          }

          const amountInRupees = order.amount / 100;  // Convert from paise to rupees

          wallet.balance += amountInRupees;
          wallet.transactions.push({
              type: 'credit',
              amount: amountInRupees,
              description: 'Wallet recharge',
              date: new Date()
          });

          await wallet.save();

          return res.json({ 
              success: true, 
              message: "Payment verified and wallet updated successfully",
              newBalance: wallet.balance
          });
      } else {
          return res.status(400).json({ 
              success: false, 
              message: "Payment verification failed" 
          });
      }
  } catch (error) {
      console.error("Error verifying payment:", error);
      return res.status(500).json({ error: "Could not verify payment" });
  }
};

module.exports = {
    loadWallet,
    addMoneyToWallet,
    verifyWalletPayment
};