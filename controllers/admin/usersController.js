const User = require("../../models/userSchema");
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")
// List users 
const listUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim(); 

    let query = { isAdmin: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .sort({ createdOn: -1 }) 
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render("user-management", {
      users,
      currentPage: page,
      totalPages,
      search,
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
    res.json({ success: true, isBlocked: true });
  } catch (error) {
    console.log("Error blocking user", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

// Unblock a user
const unblockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    await User.findByIdAndUpdate(userId, { $set: { isBlocked: false } });
res.json({ success: true, isBlocked: false });
  } catch (error) {
    console.log("Error unblocking user", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

module.exports = {
  listUsers,
  blockUser,
  unblockUser,
};
