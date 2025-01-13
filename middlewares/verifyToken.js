// middleware.js
const jwt = require('jsonwebtoken');

const jwtSecret = process.env.SECRET_KEY_FOR_JWT;

const verifyToken = (req, res, next) => {
 //const token = req.body.token || req.query.token || req.headers["x-access-token"] ;
 let token = req.cookies['x-access-token'];
 if (!token) {
   return res.redirect("//login");
 }
 try {
   const decoded = jwt.verify(token, jwtSecret);
   req.user = decoded;
 } catch (err) {
   return res.status(401).send("Invalid Token");
 }
 return next();
};

module.exports = verifyToken; // Export the middleware
