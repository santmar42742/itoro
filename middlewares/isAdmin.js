const isAdmin = (req, res, next) => {
  // Check if the user is logged in (i.e., exists in the session)
  if (req.session.user && req.session.user.type === 'admin') {
    // User is logged in, proceed to the next middleware or route handler
    next();
  } else {
    // User is not logged in, redirect to the login page or handle it as needed
    res.redirect('//login'); // Change '/login' to your login route
  }
};

module.exports = isAdmin; // Export the middleware
