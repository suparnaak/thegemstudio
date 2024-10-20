const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();

//forgot password
const loadForgotPassword = async (req, res) => {
  try {
    res.render("forgot-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

function generateOtp() {
  return Math.random().toString().substr(2, 6);
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Password Reset",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email: email });
    if (!findUser)
      return res.render("forgot-password", { message: "User not found" });
    if (findUser.isBlocked)
      return res.render("forgot-password", { message: "Blocked by Admin" });
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json("email-error");
    }
    req.session.resetPasswordOtp = otp;
    req.session.resetPasswordEmail = email;
    console.log("OTP generated and stored in session:", otp);
    console.log("Session after storing OTP:", req.session);
    res.render("forgotpassword-verify-otp");
    console.log("Password Reset OTP sent", otp);
  } catch (error) {
    console.error("forgot password error", error);
    res.render("forgot-password", { message: "Please try again later" });
  }
};
// Verify OTP
const verifyOtp = async (req, res) => {
  console.log("Entering verifyOtp function");
  console.log("Request body (OTP entered by user):", req.body);
  console.log("Session data:", JSON.stringify(req.session, null, 2));

  try {
    let { otp } = req.body;
    otp = otp.trim();

    console.log("Received OTP from user:", otp);
    console.log("Stored OTP from session:", req.session.resetPasswordOtp);

    if (!req.session.resetPasswordOtp) {
      console.log("No OTP found in session");
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found. Please request a new one.",
      });
    }

    if (otp === String(req.session.resetPasswordOtp)) {
      console.log("OTP matched successfully");

      req.session.resetPasswordOtp = null;
      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        redirectUrl: "/reset-password",
      });
    } else {
      console.log("OTP mismatch");
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while verifying OTP",
    });
  }
};
//resend otp
const resendOtp = async (req, res) => {
  try {
    const email = req.session.resetPasswordEmail;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.resetPasswordOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend Otp", otp);
      res
        .status(200)
        .json({ success: true, message: "OTP resent successfully" });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again",
      });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(500).json({
      success: false,
      message: "Internal Server error. Please try again",
    });
  }
};
//reset password
const loadResetPassword = async (req, res) => {
  try {
    res.render("reset-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, cpassword } = req.body;
    const email = req.session.resetPasswordEmail;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Session expired. Please request a password reset again.",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (password !== cpassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    await user.save();

    req.session.resetPasswordEmail = null;

    res
      .status(200)
      .json({ success: true, message: "Password reset successfully!" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res
      .status(500)
      .json({ success: false, message: "Error resetting password" });
  }
};
//load account
const loadMyAccount = async (req, res) => {
  try {
    const user = req.session.user;
    if (user) {
      res.render("account-page", { user: user });
    }
  } catch (error) {
    console.log("My account page not found:", error);
    res.status(500).send("Server Error");
  }
};
//load chnage passwords
const loadChangePassword = async (req, res) => {
  try {
    const user = req.session.user;
    if (user) {
      res.render("change-password", { user: user });
    }
  } catch (error) {
    console.log("Change Password not found:", error);
    res.status(500).send("Server Error");
  }
};
//change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user._id; // Get the user ID from the session

    // Fetch the user from the database using the ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if the current password matches the one in the database
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Check if new password and confirm password are the same
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirm password do not match' });
    }

    // Check if the new password is the same as the current password
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password cannot be the same as the current password' });
    }

    // Hash the new password and update it in the database
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // If everything is fine, send success response
    return res.status(200).json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ success: false, message: 'An error occurred while changing the password' });
  }
};
//load orders
const loadMyOrders = async (req, res) => {
  try {
    const user = req.session.user;
    if (user) {
      const page = parseInt(req.query.page) || 1; 
      const limit = 2; 
      const skip = (page - 1) * limit; 

      
      const totalOrders = await Order.countDocuments({ userId: user._id });

      const orders = await Order.find({ userId: user._id })
        .populate({
          path: "items.productId", 
          populate: {
            path: "brand", 
            select: "brandName" 
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip) 
        .limit(limit); 

      const totalPages = Math.ceil(totalOrders / limit);

      res.render("myorders-page", {
        orders: orders,
        razorpayKey: process.env.RAZORPAY_KEY_ID,
        user: req.user,
        currentPage: page,
        totalPages: totalPages,
      });
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    console.log("Orders page not found:", error);
    res.status(500).send("Server Error");
  }
};

const updateProfile = async (req, res) => {
  const { userId, name, phone } = req.body;
  try {
    if (!name || !phone) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { name, phone },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    req.session.user.name = name;
    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};


module.exports = {
  loadForgotPassword,
  forgotPassword,
  loadResetPassword,
  verifyOtp,
  resendOtp,
  resetPassword,
  loadMyAccount,
  loadMyOrders,
  updateProfile,
  loadChangePassword,
  changePassword,
};
