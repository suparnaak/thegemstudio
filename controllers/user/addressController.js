const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");

const loadManageAddresses = async (req, res) => {
  try {
    const user = req.session.user;
    const addresses = await Address.find({ userId: user._id });

    if (!addresses || addresses.length === 0) {
      return res.render("addresses-page", {
        message: "No addresses added. Add a new address to get started!",
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
    res.status(500).render("addresses-page", {
      message: "Failed to fetch addresses due to an error.",
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
    res.status(500).send("Server Error");
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
    res.status(500).json({ message: "Failed to add address" });
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
        res.render("edit-address", { user: user, address: null, message: "No address found" });
      }
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    console.error("Error loading edit address page:", error);
    res.status(500).send("Server Error");
  }
};
const editAddress = async (req, res) => {
  try {
    const userId = req.params.userId;
    const address = await Address.findOne({ _id: addressId, userId: userId });

    if (!address) {
      return res.status(403).send("You do not have permission to edit this address");
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
    res.status(500).send("Server Error");
  }
};
//delete address
const deleteAddress = async (req, res) => {
  try {
    const user = req.session.user;

    const addressId = req.params.addressId;

    await Address.findOneAndDelete({ _id: addressId });

    res.json({ message: "Address deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete address" });
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
