const Wallet = require("../../models/walletSchema");

const loadWallet = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id;

    if (user) {
      let wallet = await Wallet.findOne({ userId });

      // If no wallet found, create one with an initial balance of 0
      if (!wallet) {
        wallet = new Wallet({
          userId: userId,
          balance: 0, // Initial balance
          transactions: [], // No transactions yet
        });
        await wallet.save();
      }
      
      // Render the wallet page
      res.render("wallet", { 
        user: user, 
        balance: wallet.balance || 0, // Default to 0 if no balance
        transactions: wallet.transactions || [], // Default to empty array if no transactions
      });
    }
  } catch (error) {
    console.log("Wallet page not found:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  loadWallet
};
