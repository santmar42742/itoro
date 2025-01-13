var express = require('express');
var router = express.Router();
const { User } = require('../models/user');
const { Task } = require('../models/task');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const moment = require('moment-timezone');
const schedule = require('node-schedule');
const checkAuth = require("../middlewares/checkAuth");
const isAdmin = require("../middlewares/isAdmin");
const AsyncLock = require('async-lock');
const lock = new AsyncLock();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null,'./public/uploads'); // Set the destination folder for uploaded files
  },
  filename: function (req, file, cb) {
      // Set the filename to be unique (you can customize this)
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});



const upload = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 } // Limit file size to 5 MB (adjust as needed)
});



const baseURL = process.env.BASE_URL || ''; // Default to an empty string if BASE_URL is not defined
const routePath = `${baseURL}/`;
router.use(routePath, router);

router.get('/profile',checkAuth, async (req, res, next) => {
  const vipLevels = [
    { level: 1, badge: '/images/badges/lvl1.png' },
    { level: 2, badge: '/images/badges/lvl2.png' },
    { level: 3, badge: '/images/badges/lvl3.png' },
    { level: 4, badge: '/images/badges/lvl 4.png' }, 
    { level: 5, badge: '/images/badges/lvl 5.png' },
    { level: 6, badge: '/images/badges/lvl6.png' }
    // Add more levels and badge images as needed
  ];


  // Access the user from the session
  const user = await User.findById(req.session.user._id);

  if (user) {
    // Find the user's VIP level
    const userVIPLevel = user.level; // Change this to your user's VIP level property

    // Logging for debugging
   // console.log('User VIP Level:', userVIPLevel);

    // Find the corresponding badge for the user's VIP level
    const userVIPBadge = vipLevels.find(level => level.level === userVIPLevel);

    // Logging for debugging
    //console.log('User VIP Badge:', userVIPBadge);

    res.render('users/profile', { user,  userVIPBadge });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

router.get('/profile/settings',checkAuth, async(req, res, nxet) => {
  const user = req.session.user;

  res.render('users/profileSettings',{user})
});

router.post('/profile/settings/changepassword',checkAuth, async (req, res, next) => {
  const userId = req.session.user._id; // Get the user's ID from the session

  try {
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the old password matches the user's current password
    const passwordMatch = await bcrypt.compare(req.body.oldloginpassword, user.password);

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Old password is incorrect' });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(req.body.newloginpassword, 10);

    // Update the user's password
    user.password = hashedNewPassword;

    // Save the updated user to the database
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error changing password' });
  }
});


router.post('/profile/settings/changewithdrawalpassword',checkAuth, async (req, res, next) => {
  const userId = req.session.user._id; // Get the user's ID from the session

  try {
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the old password matches the user's current password
    const passwordMatch = await bcrypt.compare(req.body.oldwithdrawalpassword, user.withdrawalPassword);

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Old withdrawal password is incorrect' });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(req.body.newwithdrawalpassword, 10);

    // Update the user's password
    user.withdrawalPassword = hashedNewPassword;

    // Save the updated user to the database
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

//admin panel things start from here
router.get('/admin/dashboard',isAdmin,checkAuth, async function(req, res, next) {
  try {
    const users = await User.find();
    const user = await User.findById(req.session.user._id);

    const totalUsers = users.length;
    
    const activeUsers = users.filter(user => user.status === 'active').length;
    const inactiveUsers = users.filter(user => user.status === 'inactive').length;
    const blockedUsers = users.filter(user => user.status === 'blocked').length;
    
    const activePercentage = (activeUsers / totalUsers) * 100;
    const inactivePercentage = (inactiveUsers / totalUsers) * 100;
    const blockedPercentage = (blockedUsers / totalUsers) * 100;

    // Sort the users by their creation date in descending order
    users.sort((a, b) => b.createdAt - a.createdAt);

    // Extract the newest users into separate variables
    const newestUser1 = users[0];
    const newestUser2 = users[1];
    const newestUser3 = users[2];

    res.render('admin/dashboard', {
      users,user,
      activePercentage,
      inactivePercentage,
      blockedPercentage,
      newestUser1,
      newestUser2,
      newestUser3,
      activeUsers,
      inactiveUsers,
      blockedUsers
    });
  } catch (err) {
    next(err);
  }
});

// Function to fetch users and calculate pagination details
const fetchUsers = async (page, usersPerPage) => {
  const users = await User.find();
  const startIndex = (page - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const totalUsers = users.length;
  const usersToDisplay = users.slice(startIndex, endIndex);
  return { usersToDisplay, totalUsers };
};

// Route to handle the initial page and user listing


// Route to handle paginated requests
router.get('/admin/users/page/:number',isAdmin,checkAuth, async function(req, res, next) {
  const page = parseInt(req.params.number) || 1; // Get the current page from the URL parameters or default to 1
  const limit = 14; // Number of posts per page

  try {
    let users;
    users = await User.find()
    .skip((page - 1) * limit)
    .limit(limit);
    totalUsers = (await User.find()).length;

    const totalPages = Math.ceil(totalUsers / limit);
    const user = await User.findById(req.session.user._id);

    res.render('admin/users', {
      users,
      user,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Route to handle paginated requests
router.get('/admin/payments/page/:number', isAdmin, checkAuth, async function(req, res, next) {
  const page = parseInt(req.params.number) || 1; // Get the current page from the URL parameters or default to 1
  const limit = 14; // Number of users per page

  try {
    // Modify the query to find users with paymentProof
    let users;
    users = await User.find({ paymentProof: { $exists: true, $ne: null, $ne: '' } })
      .skip((page - 1) * limit)
      .limit(limit);

    totalUsers = (await User.find({ paymentProof: { $exists: true, $ne: null, $ne: '' } })).length;

    const totalPages = Math.ceil(totalUsers / limit);
    const user = await User.findById(req.session.user._id);

    res.render('admin/payments', {
      users,
      user,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/admin/withdrawrequests/page/:number', isAdmin, checkAuth, async function(req, res, next) {
  const page = parseInt(req.params.number) || 1; // Get the current page from the URL parameters or default to 1
  const limit = 14; // Number of users per page

  try {
    // Modify the query to find users with paymentProof
    let users;
    users = await User.find({
      'withdrawRequest.trc20Address': { $exists: true, $ne: null, $ne: '' },
      'withdrawRequest.exchange': { $exists: true, $ne: null, $ne: '' },
      'withdrawRequest.amount': { $ne: 0 }
  })
  .skip((page - 1) * limit)
  .limit(limit);
  

    totalUsers = (await User.find({ paymentProof: { $exists: true, $ne: null, $ne: '' } })).length;

    const totalPages = Math.ceil(totalUsers / limit);
    const user = await User.findById(req.session.user._id);

    res.render('admin/withdrawrequests', {
      users,
      user,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to handle paginated requests
router.get('/edit/:id',isAdmin,checkAuth, async function(req, res, next) {
 
  try {
    const user =await User.findById(req.params.id)
    //console.log(user)

    res.render('admin/edituser',{user})
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/edit/balance/:id',isAdmin,checkAuth, async function(req, res, next) {
 
  try {
    const user = await User.findById(req.params.id)
    let amount = parseInt(user.account.balance, 10);
    let changedAmount = amount - req.body.newbalance;
    user.notifications.push({
      message: 'Withdrawn $'+changedAmount,
    });
  
  // Remove the oldest notification if there are more than 3
  if (user.notifications.length > 3) {
      user.notifications.shift(); // Remove the first element (oldest notification)
  }
    user.account.balance = req.body.newbalance;

    await user.save();
    res.render('admin/edituser',{user})
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/edit/creditscore/:id',isAdmin,checkAuth, async function(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    
    // Ensure the new credit score is within the valid range [0, 100]
    const newCreditScore = parseInt(req.body.newcreditscore);
    
    if (isNaN(newCreditScore) || newCreditScore < 0 || newCreditScore > 100) {
      return res.status(400).json({ error: 'Invalid credit score. Please provide a value between 0 and 100.' });
    }

    user.creditscore = newCreditScore;

    await user.save();
    res.render('admin/edituser', { user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/edit/withdrawnamount/:id',isAdmin,checkAuth, async function(req, res, next) {
 
  try {
    const user = await User.findById(req.params.id)
    user.account.withdrawnAmount= req.body.newwithdrawnamount;

    await user.save();
    res.render('admin/edituser',{user})
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/delete/:id',isAdmin,checkAuth, async function(req, res, next) {
  try {
    const user = await User.deleteOne({ _id: req.params.id });
    if (user.deletedCount === 1) {
      // User was deleted successfully
      res.redirect('/users/admin/users/page/1');
    } else {
      // User with the specified ID was not found
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status/deactivate/:id',isAdmin,checkAuth, async function(req, res, next) {
 
  try {
    const user = await User.findById(req.params.id)
    user.status="inactive"
    await user.save();
    res.render('admin/edituser',{user})
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status/activate/:id',isAdmin,checkAuth, async function(req, res, next) {
 
  try {
    const user = await User.findById(req.params.id)
    user.status="active"
    await user.save();
    res.render('admin/edituser',{user})
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status/block/:id',isAdmin,checkAuth, async function(req, res, next) {
 
  try {
    const user = await User.findById(req.params.id)
    user.status="blocked"
    await user.save();
    res.render('admin/edituser',{user})
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tasks/enable/:id',isAdmin,checkAuth, async function(req, res, next) {
 
  try {
    const user = await User.findById(req.params.id)
    user.taskgeneration="unrestricted"
    user.tasksdone=0;
    await user.save();
    res.render('admin/edituser',{user})
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tasks/disable/:id',isAdmin,checkAuth, async function(req, res, next) {
 
  try {
    const user = await User.findById(req.params.id)
    user.taskgeneration="restricted"
    user.tasksdone=40;
    await user.save();
    res.render('admin/edituser',{user})
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/level/up/:id',isAdmin,checkAuth, async function (req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    
    if (user.level !== undefined) {
      // Convert the user's level from a string to an integer
      user.level = parseInt(user.level, 10);
      let num = user.level+1;
      if (user.level < 6) {
        // Increase the user's level by 1
        user.level = user.level + 1;
        user.notifications.push({
          message: 'Promoted to Lvl '+num,
      });
      
      // Remove the oldest notification if there are more than 3
      if (user.notifications.length > 3) {
          user.notifications.shift(); // Remove the first element (oldest notification)
      }
        await user.save();
      }
    }
    
    res.render('admin/edituser', { user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/level/down/:id',isAdmin,checkAuth, async function (req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    let num = user.level+1;

    if (user.level !== undefined) {
      // Convert the user's level from a string to a number
      user.level = parseInt(user.level, 10);
      let num = user.level-1;

      // Decrease the user's level by 1, but ensure it doesn't go below 0
      user.level = Math.max(0, user.level - 1);
      user.notifications.push({
        message: 'demoted to Lvl '+num,
    });
    
    // Remove the oldest notification if there are more than 3
    if (user.notifications.length > 3) {
        user.notifications.shift(); // Remove the first element (oldest notification)
    }
      await user.save();
    }
    
    res.render('admin/edituser', { user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

////////////////////////////////////



async function generateTasksForUsers() {
  await lock.acquire('generateTasksForUsers', async function () {
    try {
      const users = await User.find();
      console.log("Starting the task generation");

      console.log(`Total users: ${users.length}`);

      for (const user of users) {
        console.log(`Generating tasks for user: ${user._id}`);


        const maxTasks = getMaxTasksForUser(user.level);
        const userTasks = user.tasks || [];
        const tasksToGenerate = Math.min(40, maxTasks - userTasks.length);

        for (let i = 0; i < tasksToGenerate; i++) {

          const count = user.tasks.length;
          console.log("Task number"+count)
          const task = new Task({
            title: count + 1,
            level: user.level,
            user: user,
            expiresAt: calculateExpirationTime(),
          });

          await task.save();
          user.tasks.push(task._id);
        }

        await user.save();
        console.log(`Tasks generated for user: ${user._id}`);
      }
    } catch (error) {
      console.error('Error in generateTasksForUsers:', error);
    }
  });
}


function getMaxTasksForUser(level) {
  // Define the maximum tasks per VIP level
  const maxTasksByLevel = {
      0: 40,
      1: 40,
      2: 40,
      3: 40,
      4: 40,
      5: 40,
      6: 40,
  };

  return maxTasksByLevel[level] || 0;
}




function calculateExpirationTime() {
  const currentTime = moment.tz('America/New_York'); // Set the appropriate timezone
  return currentTime.add(23, 'hours').add(59, 'minutes').toDate();
}



// Schedule the job to run every 1 minute
// Define the start time (10:15 PM) for task generation
const taskGenerationStartTime = new Date();
taskGenerationStartTime.setHours(0, 18, 0, 0); // 10:15 PM in Pakistani time

// Define the start time (10:14 PM) for clearing tasks
//const clearTasksStartTime = new Date();
//clearTasksStartTime.setHours(1, 25, 0, 0); // 10:14 PM in Pakistani time

// Schedule the job for task generation to run every 20 
const dailyTaskGeneration = schedule.scheduleJob('*/59 * * * *', function () {
  console.log('Scheduled task generation started.');
  generateTasksForUsers();
});



// Schedule the job for clearing tasks to run once daily at 8:00 AM in America/New_York time zone
const clearTasks = schedule.scheduleJob({ hour: 8, minute: 0, tz: 'America/New_York' }, function () {
  console.log("Scheduled job started at", new Date());
  clearAllTasks();
  console.log("Scheduled job completed at", new Date());
});
// Function to clear all tasks from the database and the user model once daily
async function clearAllTasks() {
  try {
      // Clear tasks from the database
      await Task.deleteMany({});

      // Clear tasks from the user model
      const users = await User.find();
      for (const user of users) {
          user.tasks = []; // Clear the tasks array
          user.claimedTasks = []; // Clear the tasks array

          user.unclaimedTasks = []; // Clear the tasks array

          await user.save();
      }

      console.log('All tasks cleared from the database and user model.');
  } catch (err) {
      console.error('Error clearing tasks:', err);
  }
}




function isTaskClaimable(task) {
  const currentTime = new Date();
  return currentTime <= task.expiresAt;
}


// async function handleExpiredTasks() {
//   const currentTime = new Date();
//   const expiredTasks = await Task.find({
//     claimedAt: null,
//     expiresAt: { $lte: currentTime },
//     'user': req.session.user._id, // Replace 'userId' with the actual user ID you want to match
//   });
  

//   for (const task of expiredTasks) {
//     // Move the task to the user's task history or delete it, as needed
//     // Update user's balance, etc.
//     let userId = task.user;
//     console.log(userId)

//     let user = await User.findById(userId);

//     user.unclaimedTasks.push(task);

//     await user.save();
//   }
// }


// const expirationCheck = schedule.scheduleJob('*/1 * * * *', function () {
//   handleExpiredTasks();
// });

async function claimTask(user, taskId) {
  const task = await Task.findById(taskId);

  if (!task || task.claimedBy) {
    // Task doesn't exist or is already claimed
    return false;
  }

    
  if (isTaskClaimable(task)) {
    const user1=await User.findById(user._id)
    task.claimedBy = user._id;
    task.claimedAt = new Date();
    await task.save();
    user1.claimedTasks.push(task);
    user1.account.balance = user1.account.balance + 1;
    user1.tasksdone=user1.tasksdone+1;
    if(user1.tasksdone>=40){
      user1.taskgeneration='restricted'
    }
    await user1.save();

    //console.log("task claimed")
    // Handle the user's balance and other logic as needed
    // Subtract task rewards, etc.
    
    return true;
  }

  return false;
}
// Sample route to claim a task
router.get('/claim-task/:id',checkAuth, async (req, res) => {
  const taskId = req.params.id;
  const user = req.session.user; // Assuming you have user authentication
  const claimed = await claimTask(user, taskId);

  if (claimed) {
    //res.status(200).json({ message: 'Task claimed successfully.' });
    res.redirect("https://tii.la/6RKLUS6Cz6")
  } else {
    res.status(400).json({ message: 'Task is no longer claimable.' });
  }
});


///////////////////////////////////
router.get('/tasks',checkAuth, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const currentDate = new Date();
    const user = req.session.user;

    const tasks = await Task.find({
      claimedBy: null, // Not yet claimed
      expiresAt: { $gt: currentDate }, // Not yet expired
      user: userId, // Match tasks for a specific user
    });

    res.render("tasks", { tasks ,user});
  } catch (err) {
    console.error(err);
    // Handle the error appropriately, e.g., by rendering an error page or sending an error response.
  }
});

router.get('/claimedtasks',checkAuth, async (req, res) => {

  // Get the user ID from the request
  const userId = req.session.user._id;
  const user = await User.findById(userId)
  let claimedTasks =  user.claimedTasks;
  // Get the user's tasks
  //const tasks = await Task.find({ userId });
  res.render("claimedtasks",{claimedTasks,user})

 // res.json(await user.claimedTasks);
});


router.get('/unclaimedtasks',checkAuth, async (req, res) => {

  const userId = req.session.user._id;
  const user = req.session.user;


  const currentTime = new Date();
  const expiredTasks = await Task.find({
    claimedAt: null,
    expiresAt: { $lte: currentTime },
    'user': req.session.user._id, 
  });
  
  res.render("unclaimedtasks",{expiredTasks,user})
  //res.json(expiredTasks);
});


router.get('/withdraw',checkAuth, async (req, res) => {
  const user = req.session.user;
  res.render("withdraw",{user})
});



// Handle form submission
router.post('/withdraw-request', async (req, res) => {
  try {
    console.log('Request Body:', req.body); // Log the request body

      const userId = req.session.user._id; // Replace with the actual user ID
      const { trc20Address, exchange, amount } = req.body;

      const user = await User.findById(userId);

      if (user) {
          // Validate amount as a number
          const parsedAmount = parseFloat(amount);

          if (isNaN(parsedAmount)) {
              return res.status(400).json({ error: 'Invalid amount. Please provide a valid number.' });
          }

          user.withdrawRequest = {
              trc20Address,
              exchange,
              amount: parsedAmount,
          };

          await user.save();

          return  res.json({ success: true, message: 'Withdrawal request submitted successfully you can go back and continue using the site' });

      } else {
          return res.status(404).json({ error: 'User not found' });
      }
  } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/upload-payment-proof', upload.single('paymentProof'), async (req, res) => {
  try {
      const userId = req.session.user._id;
      const user = await User.findById(userId);

      if (!user) {
          return res.status(404).json({ error: 'User not found' });
      }

      // Save the file path or URL in the user's paymentProof field
      user.paymentProof = path.join('uploads', req.file.filename); // Assuming the file path is stored in req.file.path
      await user.save();

      res.json({ message: 'Payment proof uploaded successfully you can go back and continue using the site' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});
module.exports = router;
