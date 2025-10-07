const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")

const loadManageAddresses = async (req, res) => {
  try {
    const user = req.session.user;
    const addresses = await Address.find({ userId: user._id });
    if (!addresses || addresses.length === 0) {
      return res.render("addresses-page", {
        message: MESSAGES.ADDRESS.NO_ADDRESS,
        addresses: [],
        user: req.session.user,
      });
    }
    res.render("addresses-page", {
      addresses,
      user: user,
      message: null,
    });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).render("addresses-page", {
      message: MESSAGES.GENERAL.SERVER_ERROR,
      addresses: [],
      user: user,
    });
  }
};
//add address 
const loadAddAddress = async (req, res) => {
  try {
    const user = req.session.user;
    if (user) {
      res.render("add-address", { user: user });
    }
  } catch (error) {
    console.log("Add address page not found:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
  }
};

const addAddress = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = req.session.user._id;
    const { name, houseName, street, city, country, zipcode, mobile } =
      req.body;

    const address = new Address({
      userId,
      name,
      houseName,
      street,
      city,
      country,
      zipcode,
      mobile,
    });

    await address.save();

    const addresses = await Address.find({ userId });

    res.render("addresses-page", { user: user, addresses: addresses });
  } catch (error) {
    console.error(error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

//edit address
const loadEditAddress = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id;
    const addressId = req.params.addressId;

    if (user) {
    
      const address = await Address.findOne({ _id: addressId, userId: userId });

      if (address) {
        
        res.render("edit-address", { user: user, address: address });
      } else {
        res.render("edit-address", { user: user, address: null, message: MESSAGES.ADDRESS.NO_ADDRESS });
      }
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    console.error("Error loading edit address page:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
  }
};
const editAddress = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id;
    const addressId = req.params.addressId;
    const address = await Address.findOne({ _id: addressId, userId: userId });

    if (!address) {
      return res.status(STATUSCODES.FORBIDDEN).send(MESSAGES.ADDRESS.DENY_EDIT);
    }

    // Update the address
    await Address.findByIdAndUpdate(addressId, {
      name: req.body.name,
      houseName: req.body.houseName,
      street: req.body.street,
      city: req.body.city,
      zipcode: req.body.zipCode,
      country: req.body.country,
      mobile: req.body.mobile,
    });

    res.redirect("/manage-addresses");
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
  }
};
//delete address
const deleteAddress = async (req, res) => {
  try {
    const user = req.session.user;

    const addressId = req.params.addressId;

    await Address.findOneAndDelete({ _id: addressId });

    res.json({ message: MESSAGES.ADDRESS.DELETED });
  } catch (error) {
    console.error(error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
  }
};
module.exports = {
  loadManageAddresses,
  loadAddAddress,
  addAddress,
  deleteAddress,
  loadEditAddress,
  editAddress,
};
