const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport");
const db = require("./config/db");
const exp = require("constants");
const nocache = require("nocache");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
db();

app.use(express.json()); //form data is converted into json
app.use(express.urlencoded({ extended: true })); //to convert query string data

//session management
app.use(
  session({
    secret: process.env.SESSION_SECRETE,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    },
  })
);

//passport initialization for google sign up
app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);
app.use(express.static(path.join(__dirname, "public/")));
app.use('/uploads', express.static('public/uploads'));


app.use(nocache());

app.use("/", userRouter);
app.use("/admin", adminRouter);

//server creation
app.listen(process.env.PORT, () => {
  console.log("server running");
});

module.exports = app;
