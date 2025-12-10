const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        if (!token) {
            return res.status(401).send({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).send({ error: 'Authentication required' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).send({ error: 'Authentication required' });
    }
};

module.exports = authMiddleware;