const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked) {
          next();
        } else {
          // Destroy the session if the user is blocked
          req.session.destroy((err) => {
            if (err) {
              console.error("Error destroying session:", err);
              res.status(500).send("Error destroying session");
            } else {
              res.redirect("/login");
            }
          });
        }
      })
      .catch((error) => {
        console.log("Error in user auth middleware");
        res.status(500).send("Internal server Error");
      });
  } else {
    res.redirect("/login");
  }
};

const isLoggedIn = (req, res, next) => {
  if (req.session.user) {
    // If user is logged in, redirect to home page
    res.redirect('/');
  } else {
    // If user is not logged in, proceed to the next middleware/route handler
    next();
  }
};
/* const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked) {
          next();
        } else {
          // Destroy the session if the user is blocked
          req.session.destroy((err) => {
            if (err) {
              console.error("Error destroying session:", err);
              res.status(500).send("Error destroying session");
            } else {
              res.redirect("/login");
            }
          });
        }
      })
      .catch((error) => {
        console.log("Error in user auth middleware");
        res.status(500).send("Internal server Error");
      });
  }  else {
    res.redirect("/login");
  } 
}; */

const adminAuth = (req, res, next) => {
  if(req.session.admin){
    User.findOne({ isAdmin: "true" })
      .then(data => {
        if (data) {
          next();
        } else {
          res.redirect("/admin/login");
        }
      })
      .catch(error => {
        console.log("Error in adminAuth middleware", error);
        res.status(500).send("Internal Server Error");
      });
  } else {
    res.redirect("/admin/login");
  }
};

module.exports = {
  userAuth,
   isLoggedIn, 
  adminAuth
}; 