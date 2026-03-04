const { db } = require('../config/database');

// In Firebase, we don't need a rigid schema definition, 
// we just export the collection reference to be used by controllers.
const User = db.collection('users');

module.exports = User;
