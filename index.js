// Required modules
const express = require('express');
const mongoose = require('mongoose');
const shortid = require('shortid')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { urlToHttpOptions } = require('url');

const app = express();
app.use(cors());
app.use(express.json());

// Connecting to MongoDB
mongoose.connect('mongodb+srv://urlshort:urlshort123@cluster0.70nqoe4.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define user schema
const userSchema = new mongoose.Schema({
    firstname: String,
    lastname: String,
    username: String,
    password: String,
    resetToken: String,
    resetTokenExpiration: Date,
    activeToken: String,
    activeStatus: {
        type: Boolean,
        default: false, 
      },
  });
  
  const myUser = mongoose.model('myUser', userSchema);
  
  // Register a new user using post
  app.post('/url/register', async (req, res) => {
    try {
      const { firstname, lastname, username,password } = req.body;
  
      // Check if the user already exists
      const existingUser = await myUser.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
      //generate activation link
      const activationToken = crypto.randomBytes(32).toString('hex');
    //   console.log(activationToken);
  
      // Hash the password for security purpose
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create a new user
      const newmyUser = new myUser({
        firstname,
        lastname,
        username,
        password: hashedPassword,
        activeToken: activationToken,
        activeStatus: false,
        
      });
  
      // Save the user to the database
      await newmyUser.save();

       // Send Account Activation email

      const transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
           port: 587,
           auth: {
              user: 'nestor41@ethereal.email',
              pass: 'UtZBFMWwTswYRFhDEV'
          },
         });
    
         const mailOptions = {
           from: 'nestor41@ethereal.email',
          to: myUser.email,
           subject: 'Account Activation',
           text: `You are receiving this email because you requested a Account activation. Click the following link to reset your password: http://localhost:3000/account-activate/${activationToken}`,
         };
    
          transporter.sendMail(mailOptions);
    
//         res.json({ message: 'Password reset email sent',resetToken });
  
      res.status(201).json({ message: 'User registered successfully and check your email to activate the account', activationToken });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

// Endpoint to activate the account when the user clicks the activation link
app.get('/url/account-activate/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const user = await myUser.findOne({ activeToken: token });
  
      if (!user) {
        return res.status(404).json({ message: 'Activation token not found' });
      }
  
      // Update the user's activeStatus to true
      user.activeStatus = true;
    //   user.activeToken = ''; 
      await user.save();
  
      res.status(200).json({ message: 'Account activated successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // create User login using post
  app.post('/url/login', async (req, res) => {
      try {
        const { username, password } = req.body;
    
        // Find the user by email
        const myuser = await myUser.findOne({ username });
        if (!myuser) {
          return res.status(404).json({ message: 'User not found check your email' });
        }

        // check account is active or not

        if (!myuser.activeStatus){
            return res.status(403).json({ message: 'Account not activated' });
        }
    
        // Check if the password is correct
        const isPasswordValid = await bcrypt.compare(password, myuser.password);
        if (!isPasswordValid) {
          return res.status(401).json({ message: 'Invalid password check your password' });
        }
    
        // Generate a JWT token
        const token = jwt.sign({ userId: myuser._id }, 'your-secret-key');
    
        // res.json({ token });
        res.json({ message: 'Signin successful' , myuser, token});
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });
  
  // create forget password by post
  app.post('/url/forgot-password', async (req, res) => {
    try {
      const { username } = req.body;
  
      // Find the user by email
      const myuser = await myUser.findOne({ username });
      if (!myuser) {
        return res.status(404).json({ message: 'User not found check email' });
      }
  
      // Generate password reset token
      const resetToken = jwt.sign({ userId: myuser._id }, 'your-secret-key', {
        expiresIn: '1h',
      });
  
      // Update user's reset token and expiration
      myuser.resetToken = resetToken;
      myuser.resetTokenExpiration = Date.now() + 3600000; // 1 hour
      await myuser.save();
  
      // Send password reset email
      const transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          auth: {
              user: 'nestor41@ethereal.email',
              pass: 'UtZBFMWwTswYRFhDEV'
          },
        });
    
        const mailOptions = {
          from: 'nestor41@ethereal.email',
          to: myuser.username,
          subject: 'Password Reset',
          text: `You are receiving this email because you requested a password reset. Click the following link to reset your password: http://localhost:3000/reset-password/${resetToken}`,
        };
    
        await transporter.sendMail(mailOptions);
    
        res.json({ message: 'Password reset email sent',resetToken });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });
  
  // Reset password
  app.post('/url/reset-password', async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body;
  
      // Find the user by reset token
      const myuser = await myUser.findOne({
        resetToken,
        resetTokenExpiration: { $gt: Date.now() },
      });
      if (!myuser) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }
  
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      // Update user's password and reset token
      myuser.password = hashedPassword;
      myuser.resetToken = null;
      myuser.resetTokenExpiration = null;
      await myuser.save();
  
      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get all users
  app.get('/url/users', async (req, res) => {
    try {
      // Find all users
      const myusers = await myUser.find();
  
      res.json({ myusers });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // create short-url by using long-url

 
  const urlSchema = new mongoose.Schema({
    originalUrl: String,
    shortUrl: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  });
  
  const Url = mongoose.model('Url', urlSchema); // Rename the variable here
  
  app.post('/url/shorten', async (req, res) => {
    try {
      const { longUrl } = req.body;
  
      if (!longUrl) {
        return res.status(400).json({ error: 'Long URL is required' });
      }
  
      const shortCode = shortid.generate();
      const shortUrl = `http://localhost:3000/url/${shortCode}`;
  
      const newUrl = new Url({ // Use a different variable name here
        originalUrl: longUrl,
        shortUrl,
      });
  
      await newUrl.save();
  
      res.json({ shortUrl });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  

 // Endpoint for redirecting to the original URL using the short code
app.get('/url/:shortUrl', async (req, res) => {
  try {
    const { shortUrl } = req.params;

    const urlRecord = await Url.findOne({ shortUrl: `http://localhost:3000/url/${shortUrl}` });

    if (!urlRecord) {
      return res.status(404).json({ message: 'Short URL not found' });
    }

    res.redirect(urlRecord.originalUrl);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//total URL created per day

app.get('/url/stats/day', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Url.aggregate([
      {
        $match: {
          createdAt: {
            $gte: today,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//total URL cretead per month

app.get('/url/stats/month', async (req, res) => {
  try {
    const result = await Url.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//getting all created urls

app.get('/all', async (req, res) => {
  try {
    const urls = await Url.find();

    res.json(urls);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
  });