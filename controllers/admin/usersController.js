const User = require("../../models/userSchema");

// List users with pagination
const listUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const users = await User.find({ isAdmin: false }).skip(skip).limit(limit);
    const totalUsers = await User.countDocuments({ isAdmin: false });
    const totalPages = Math.ceil(totalUsers / limit);

    res.render("user-management", {
      users,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log("Error listing users", error);
    res.redirect("/admin/pageerror");
  }
};

// Block a user
const blockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    await User.findByIdAndUpdate(userId, { $set: { isBlocked: true } });
    res.redirect("/admin/users");
  } catch (error) {
    console.log("Error blocking user", error);
    res.redirect("/admin/pageerror");
  }
};

// Unblock a user
const unblockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    await User.findByIdAndUpdate(userId, { $set: { isBlocked: false } });
    res.redirect("/admin/users");
  } catch (error) {
    console.log("Error unblocking user", error);
    res.redirect("/admin/pageerror");
  }
};

module.exports = {
  listUsers,
  blockUser,
  unblockUser,
};
