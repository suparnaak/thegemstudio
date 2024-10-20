const User = require("../../models/userSchema");
const loadAboutUs = async(req,res)=>{
    try {
        const user = req.session.user;

        return res.render("aboutus",{ user: user || null, });
    } catch (error) {
        return res.render('/pageNotFound')
    }
}
const loadPrivacyPolicy = async(req,res)=>{
    try {
        const user = req.session.user;

        return res.render("privacy-policy",{ user: user || null, });
    } catch (error) {
        return res.render('/pageNotFound')
    }
}
const loadTermsAndconditions = async(req,res)=>{
    try {
        const user = req.session.user;

        return res.render("terms-and-conditions",{ user: user || null, });
    } catch (error) {
        return res.render('/pageNotFound')
    }
}
const loadReturnPolicy = async(req,res)=>{
    try {
        const user = req.session.user;

        return res.render("return-policy",{ user: user || null, });
    } catch (error) {
        return res.render('/pageNotFound')
    }
}
const loadContactUs = async(req,res)=>{
    try {
        const user = req.session.user;

        return res.render("contact-us",{ user: user || null, });
    } catch (error) {
        return res.render('/pageNotFound')
    }
}
// Page not found
const pageNotFound = async (req, res) => {
    try {
      const user = req.session.user;
      res.render("page-404",{user: user || null});
    } catch (error) {
      res.redirect("/pageNotFound");
    }
  };
  

module.exports = {
    loadAboutUs,
    pageNotFound,
    loadPrivacyPolicy,
    loadTermsAndconditions,
    loadReturnPolicy,
    loadContactUs
}