const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');

const loadManageAddresses = async (req, res) => {
    try {
      const user = req.session.user; 
      const addresses = await Address.find({ userId: user._id });
  

      if (!addresses || addresses.length === 0) {
        return res.render('addresses-page', { 
          message: "No addresses added. Add a new address to get started!", 
          addresses: [], 
          user: req.session.user 
        });
      }
  
      
      res.render('addresses-page', { 
        addresses, 
        user: user, 
        message: null 
      });
  
    } catch (error) {
      console.error("Error fetching addresses:", error);
      res.status(500).render('addresses-page', { 
        message: "Failed to fetch addresses due to an error.", 
        addresses: [], 
        user: user 
      });
    }
  };
  //load add address page
  const loadAddAddress = async (req,res)=>{
    try {
        const user = req.session.user;
        if (user) {
            
            res.render("add-address", { user: user });
        } 
    } catch (error) {
        console.log("Add address page not found:", error);
        res.status(500).send('Server Error');
    }
}

    const addAddress = async (req,res)=>{
        try {
            const user = req.session.user; 
            const userId = req.session.user._id;
            const { name, houseName, street, city, country, zipcode, mobile } = req.body;
    
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
            res.status(500).json({ message: 'Failed to add address' });
        }
    }
    //edit address
    const loadEditAddress = async (req, res) => {
      try {
          const user = req.session.user;
          const addressId = req.params.addressId;
  
          if (user) {
              // Fetch the address by ID
              const address = await Address.findById(addressId);
  
              if (address) {
                  // Render the edit-address page with the current address details
                  res.render("edit-address", { user: user, address: address });
              } else {
                  res.status(404).send('Address not found');
              }
          } else {
              res.redirect('/login');
          }
      } catch (error) {
          console.error("Error loading edit address page:", error);
          res.status(500).send('Server Error');
      }
  };
  const editAddress = async (req, res) => {
    try {
        const user = req.session.user;
        const addressId = req.params.addressId;

        if (user) {
            // Find the address by ID and update it
            await Address.findByIdAndUpdate(addressId, {
                name: req.body.name,
                houseName: req.body.houseName,
                street: req.body.street,
                city: req.body.city,
                zipcode: req.body.zipCode,
                country: req.body.country,
                mobile: req.body.mobile
            });

            // Redirect back to the address management page
            res.redirect('/manage-addresses');
        } else {
            res.redirect('/login');
        }
    } catch (error) {
        console.error("Error updating address:", error);
        res.status(500).send('Server Error');
    }
};
    //delete address
    const deleteAddress = async (req, res) => {
      try {
        const user = req.session.user; 
       
          const addressId = req.params.addressId;
  
          await Address.findOneAndDelete({ _id: addressId });
  
          res.json({ message: 'Address deleted successfully' });
      } catch (error) {
          console.error(error);
          res.status(500).json({ message: 'Failed to delete address' });
      }
  }

module.exports = {
    loadManageAddresses,
    loadAddAddress,
    addAddress,
    deleteAddress,
    loadEditAddress,
    editAddress
}