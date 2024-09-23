const User = require('../../models/userSchema');
const Order  = require('../../models/orderSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require('dotenv').config();

//forgot password
const loadForgotPassword = async (req,res)=>{
    try {
        res.render('forgot-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

// OTP generation
function generateOtp() {
    return Math.random().toString().substr(2, 6)
}

// Send email OTP
async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Password Reset",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        });
        return info.accepted.length > 0;//array of addresses. Atleast 1 should be there
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
}

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body
        const findUser = await User.findOne({isAdmin: 0, email: email});
        if (!findUser)
            return res.render('forgot-password', {message: "User not found"})
        if (findUser.isBlocked)
            return res.render('forgot-password', {message: "Blocked by Admin"})
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json('email-error');
        }
        req.session.resetPasswordOtp = otp;
        req.session.resetPasswordEmail = email;
        console.log('OTP generated and stored in session:', otp);
        console.log('Session after storing OTP:', req.session);
        res.render('forgotpassword-verify-otp');
        console.log('Password Reset OTP sent', otp)
    } catch (error) {
        console.error("forgot password error", error);
        res.render('forgot-password', {message: "Please try again later"});
    }
}
// Verify OTP
const verifyOtp = async (req, res) => {
    console.log("Entering verifyOtp function");
    console.log("Request body (OTP entered by user):", req.body);
    console.log("Session data:", JSON.stringify(req.session, null, 2));

    try {
        let { otp } = req.body;
        otp = otp.trim();  // Trim any extra spaces

        console.log("Received OTP from user:", otp);
        console.log("Stored OTP from session:", req.session.resetPasswordOtp);

        // Ensure OTP is present in session
        if (!req.session.resetPasswordOtp) {
            console.log("No OTP found in session");
            return res.status(400).json({ success: false, message: 'OTP expired or not found. Please request a new one.' });
        }

        // Compare OTPs as strings
        if (otp === String(req.session.resetPasswordOtp)) {
            console.log("OTP matched successfully");
            // Clear OTP from the session after successful verification
            req.session.resetPasswordOtp = null;
            return res.status(200).json({ success: true, message: 'OTP verified successfully', redirectUrl: '/reset-password' });
        } else {
            console.log("OTP mismatch");
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        return res.status(500).json({ success: false, message: 'An error occurred while verifying OTP' });
    }
};
//resend otp
const resendOtp = async (req, res) => {
    try {
      const email = req.session.resetPasswordEmail;
      if (!email) {
        return res.status(400).json({ success: false, message: "Email not found in session" });
      }
      
      const otp = generateOtp();
      req.session.resetPasswordOtp = otp;
      
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        console.log("Resend Otp", otp);
        res.status(200).json({ success: true, message: "OTP resent successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again" });
      }
    } catch (error) {
      console.error("Error resending OTP", error);
      res.status(500).json({ success: false, message: "Internal Server error. Please try again" });
    }
  };
  //reset password
const loadResetPassword = async (req,res)=>{
    try {
        res.render('reset-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}
const resetPassword = async (req, res) => {
    try {
        const { password, cpassword } = req.body;
        const email = req.session.resetPasswordEmail;

        if (!email) {
            return res.status(400).json({ success: false, message: "Session expired. Please request a password reset again." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (password !== cpassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        user.password = hashedPassword;
        await user.save();

        req.session.resetPasswordEmail = null;

        res.status(200).json({ success: true, message: "Password reset successfully!" });

    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ success: false, message: "Error resetting password" });
    }
}
//load account
const loadMyAccount = async (req,res)=>{
    try {
        const user = req.session.user;
        if (user) {
            
            res.render("account-page", { user: user });
        } 
    } catch (error) {
        console.log("My account page not found:", error);
        res.status(500).send('Server Error');
    }
}

const loadMyOrders = async (req, res) => {
    try {
      const user = req.session.user;
      if (user) {
        const orders = await Order.find({ userId: user._id })
          .populate('addressId')
          .populate('items.productId')
          .sort({ createdAt: -1 });
  
        res.render("myorders-page", { user: user, orders: orders });
      } else {
        res.redirect('/login'); 
      }
    } catch (error) {
      console.log("Orders page not found:", error);
      res.status(500).send('Server Error');
    }
  };
  const updateProfile = async (req, res) => {
    const { userId, name, email, phone } = req.body;
    try {
    // Basic validation
    if (!name || !email || !phone) {
        return res.status(400).json({ message: 'All fields are required' });
    }

  
        // Update user information
        const user = await User.findByIdAndUpdate(userId, { name, email, phone }, { new: true });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        req.session.user.name = name;
        res.json({ message: 'Profile updated successfully', user });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
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
    updateProfile
}
