const Wallet = require("../../models/walletSchema");
const Razorpay = require("razorpay");
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")
const crypto = require("crypto");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
//wallet load
const loadWallet = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    if (user) {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: userId,
          balance: 0,
          transactions: [],
        });
        await wallet.save();
      }
      const sortedTransactions = wallet.transactions.sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });
      const transactions = sortedTransactions.slice(offset, offset + limit);
      const totalTransactions = sortedTransactions.length;
      const totalPages = Math.ceil(totalTransactions / limit);

      res.render("wallet", {
        user: user,
        balance: wallet.balance || 0,
        transactions: transactions,
        currentPage: page,
        totalPages: totalPages,
        razorpayKey: process.env.RAZORPAY_KEY_ID,
      });
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    console.error("Error loading wallet:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).render("error", { message: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

//add money to wallet
const addMoneyToWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.session.user._id;

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `wallet_recharge_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json({ order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.GENERAL.SERVER_ERROR });
  }
};
//verify wallet payment
const verifyWalletPayment = async (req, res) => {
  try {
    const { payment, order } = req.body;
    const user = req.session.user;

    if (!user) {
      return res.status(STATUSCODES.UNAUTHORIZED).json({ error: MESSAGES.GENERAL.NO_USER });
    }

    const userId = user._id;

    const text = `${order.id}|${payment.razorpay_payment_id}`;
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    if (signature === payment.razorpay_signature) {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return res.status(STATUSCODES.NOT_FOUND).json({ error: MESSAGES.GENERAL.RESOURCE_NOT_FOUND });
      }

      const amountInRupees = order.amount / 100;

      wallet.balance += amountInRupees;
      wallet.transactions.push({
        type: "credit",
        amount: amountInRupees,
        description: "Wallet recharge",
        date: new Date(),
      });

      await wallet.save();

      return res.json({
        success: true,
        message: MESSAGES.WALLET.TOPUP_SUCCESS,
        newBalance: wallet.balance,
      });
    } else {
      return res.status(STATUSCODES.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PAYMENT.VERIFY_FAILED,
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

module.exports = {
  loadWallet,
  addMoneyToWallet,
  verifyWalletPayment,
};
