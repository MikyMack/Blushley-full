// middlewares/apiAuth.js
module.exports = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
  
    if (apiKey && apiKey === process.env.INTERNAL_API_KEY) {
      return next();
    }
  
    return res.status(401).json({ error: 'Unauthorized API access' });
  };
  