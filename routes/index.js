var express = require("express");
var router = express.Router();
const { User } = require("../models/user");
const randomize = require("randomatic");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const checkAuth = require("../middlewares/checkAuth");
const isAdmin = require("../middlewares/isAdmin");
const axios = require("axios");

const cookie = require("cookie");
const baseURL = process.env.BASE_URL || ""; // Default to an empty string if BASE_URL is not defined
const routePath = `${baseURL}/`;
router.use(routePath, router);

// JWT Secret Key (replace with your own secret key)
const jwtSecret = process.env.SECRET_KEY_FOR_JWT;

const API_URL = "https://api.livecoinwatch.com/coins/";
const API_KEY = "06bea6c5-1f49-47bc-8941-2f1894b0bb70"; // Replace with your actual API key

const defaultCoins = [
  "BTC",
  "ETH",
  "XRP",
  "BNB",
  "SOL",
  "USDC",
  "ADA",
  "USDT",
  "DOGE",
  "TRX",
];

// Function to fetch coin history
async function fetchCoinHistory(coinCode) {
  try {
    const payload = {
      currency: "USD",
      code: coinCode,
      start: Date.now() - 2 * 86400000, // 24 hours ago
      end: Date.now(),
    };

    const response = await axios.post(API_URL + "single/history", payload, {
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
    });

    return response.data.history; // Return price history
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

// Function to fetch coin history
async function fetchCoins() {
  try {
    const payload = {
      currency: "USD",
      sort: "rank",
      order: "ascending",
      offset: 0,
      limit: 8,
      meta: true,
    };

    const response = await axios.post(API_URL + "list", payload, {
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
    });
    return response.data; // Return price history
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}
async function fetchCoinSingle(coinCode) {
  try {
    const payload = {
      currency: "USD",
      code: coinCode,
      meta: true,
    };

    const response = await axios.post(API_URL + "single", payload, {
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
    });
    return response.data; // Return price history
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

router.get("/", async function (req, res, next) {
  const selectedCoin = req.query.coin || "BTC"; // Default to BTC

  const coin = await fetchCoins();
  const top10Coins = coin.slice(0, 10); 
  const fetchedHistoryData = await fetchCoinHistory(selectedCoin);
  
  const historyData = JSON.stringify(fetchedHistoryData);
  res.render("landing", {
    title: "Home",
    coins: top10Coins,
    selectedCoin,
    historyData,
  });
});
router.get("/earn-by-tasks", async function (req, res, next) {
  const selectedCoin = req.query.coin || "BTC"; // Default to BTC

  const coin = await fetchCoins();
  const top10Coins = coin.slice(0, 10); 
  const fetchedHistoryData = await fetchCoinHistory(selectedCoin);
  
  const historyData = JSON.stringify(fetchedHistoryData);
  res.render("task", {
    title: "Home",
    coins: top10Coins,
    selectedCoin,
    historyData,
  });
});

router.get("/login", function (req, res, next) {
  res.render("index", { title: "Home" });
});

router.get("/home", checkAuth, async function (req, res, next) {
  const vipLevels = [
    { level: 1, badge: "/images/badges/lvl1.png" },
    { level: 2, badge: "/images/badges/lvl2.png" },
    { level: 3, badge: "/images/badges/lvl3.png" },
    { level: 4, badge: "/images/badges/lvl 4.png" },
    { level: 5, badge: "/images/badges/lvl 5.png" },
    { level: 6, badge: "/images/badges/lvl6.png" },
  ];
  const user = await User.findById(req.session.user._id);

  if (user) {
    // Find the user's VIP level
    const userVIPLevel = user.level; // Change this to your user's VIP level property

    // Logging for debugging
    // console.log('User VIP Level:', userVIPLevel);

    // Find the corresponding badge for the user's VIP level
    const userVIPBadge = vipLevels.find(
      (level) => level.level === userVIPLevel
    );

    // Logging for debugging
    //console.log('User VIP Badge:', userVIPBadge);

    const data = await fetchCoins();
    res.render("home", { user, userVIPBadge, data });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

router.get("/trade/:coinCode", checkAuth, async function (req, res, next) {
  const coinCode = req.params.coinCode.toUpperCase(); // Convert to uppercase for consistency

  try {
    const user = await User.findById(req.session.user._id);

    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const response = await fetchCoinHistory(coinCode);
    const historyData = JSON.stringify(response);

    console.log(historyData, "index roite data");

    res.render("trade", { user, historyData, selectedCoin: coinCode });
  } catch (error) {
    console.error("Error fetching coin history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      withdrawalPassword,
      password,
      clPassword,
      gender,
      refferedBy,
    } = req.body;

    // Check if the login password matches the confirmation password
    if (password !== clPassword) {
      return res
        .status(400)
        .json({
          message: "Login password and confirmation password do not match",
        });
    }

    // Check if a user with the same name or phone number already exists
    const existingUser = await User.findOne({
      $or: [{ name }, { phoneNumber }],
    });

    if (existingUser) {
      return res
        .status(400)
        .json({
          message: "A user with the same name or phone number already exists",
        });
    }

    // Check if the referred user exists and retrieve their user object
    let referredUser = null;
    if (req.body.referredBy) {
      referredUser = await User.findOne({ inviteCode: req.body.referredBy });
      //console.log("checked")

      //console.log(referredUser)

      if (!referredUser) {
        return res
          .status(400)
          .json({
            message: "Invalid referral code. Please check and try again.",
          });
      }
    }

    // Generate a unique 5-digit invite code
    let uniqueCode;
    let isCodeUnique = false;

    while (!isCodeUnique) {
      uniqueCode = randomize("0", 5); // Generate a 5-digit random code

      // Check if the code is already in use
      const existingUser = await User.findOne({ inviteCode: uniqueCode });

      if (!existingUser) {
        isCodeUnique = true;
      }
    }

    // Hash the password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPassword1 = await bcrypt.hash(withdrawalPassword, 10);

    const date = new Date();

    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();

    // Format day, month, and year to ensure they have two digits
    day = day < 10 ? `0${day}` : day;
    month = month < 10 ? `0${month}` : month;

    // Format hours, minutes, and seconds to ensure they have two digits
    hours = hours < 10 ? `0${hours}` : hours;
    minutes = minutes < 10 ? `0${minutes}` : minutes;
    seconds = seconds < 10 ? `0${seconds}` : seconds;

    let currentDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    //console.log(currentDate); // "05-11-2023 13:45:30"

    // Create a new user object with the hashed password
    const newUser = new User({
      name,
      phoneNumber,
      withdrawalPassword: hashedPassword1,
      password: hashedPassword, // Store the hashed password
      gender,
      inviteCode: uniqueCode,
      refferedBy: referredUser,
      createdAt: currentDate, // Associate the new user with the referred user
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    res.render("index");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error registering user" });
  }
});

// POST route for user login
router.post("/login", async (req, res) => {
  const { input, password } = req.body;

  try {
    // Find the user by username or phone number (assuming input can be either)
    const user = await User.findOne({
      $or: [{ name: input }, { phoneNumber: input }],
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Create a JWT token
    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: "1h",
    }); // Customize the token payload and expiration as needed

    let options = {
      path: "/",
      sameSite: true,
      maxAge: 1000 * 60 * 60 * 24, // would expire after 24 hours
      httpOnly: true, // The cookie only accessible by the web server
    };

    res.cookie("x-access-token", token, options);
    // Save user information in the session
    req.session.user = user;

    if (user.type === "admin") {
      return res.redirect("/users/admin/dashboard");
    } else {
      return res.redirect("/home");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/logout", (req, res) => {
  //console.log(req.session.user)
  res.clearCookie("x-access-token");
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    } else {
      //console.log("user is logged out")
      // Redirect the user to the login page or any other desired page after logout
      res.redirect("/login"); // Replace with the appropriate URL
    }
  });
});

router.get("/event", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("event", { user });
});

router.get("/recharge", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("recharge", { user });
});

router.get("/withdraw", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("withdraw", { user });
});

router.get("/invite", checkAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render("invite", { user });
  } catch (error) {
    res.send("error occured");
  }
});

router.get("/company", checkAuth, (req, res, next) => {
  const user = req.session.user;

  res.render("company", { user });
});

router.get("/terms-and-conditions", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("terms-and-conditions", { user });
});

router.get("/faq", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("faq", { user });
});

router.get("/certificates", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("certificate", { user });
});

router.get("/contactus", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("contactus", { user });
});

module.exports = router;
