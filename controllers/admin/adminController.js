const User = require('../../models/userSchema')
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

//page error
const pageerror = async (req,res)=>{
    res.render('admin-error');
}

//load login
const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect('/admin/dashboard');
    }
    res.render("admin-login",{message:null})
}
//login post
    const login = async (req, res) => {
        try {
            const { email, password } = req.body;
            const admin = await User.findOne({ email, isAdmin: true });
    
            if (admin) {
                const passwordMatch = await bcrypt.compare(password, admin.password);
                if (passwordMatch) {
                    req.session.admin = true;
                    return res.redirect('/admin/dashboard'); 
                } else {
                    return res.render('admin-login', { message: 'Invalid email or password' });
                }
            } else {
                return res.render('admin-login', { message: 'Admin not found' });
            }
        } catch (error) {
            console.log("login error", error);
            return res.redirect("/admin/pageerror");
        }
    };
    
//load dashboard
const loadDashboard = async (req,res)=>{
    if(req.session.admin){
        try {
            res.render("dashboard")
        } catch (error) {
            res.redirect('/pageerror')
        }
    }
}

//logout
const logout = async (req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error distryoing the session");
                return res.redirect('/pageerror');
            }
            res.redirect('/admin/login');
        })
    } catch (error) {
        console.log("Error during logout",error);
        res.redirect('/pageerror');
    }
}


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
   
}