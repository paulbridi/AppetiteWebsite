var userController = require('../controllers/user.controller');


module.exports = function(app){
	app.post('/signup', userController.createAndSaveUser);
}