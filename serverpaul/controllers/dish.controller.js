var globals = require('../configs/globals');

module.exports = function(app) {
    	//function to submit a dish
	//when user submits a dish via a post request to "/submitdish"
	//set a new dish key & store stuff in the dish/ ref in firebase
	//and push that dish key into an array in that user's mealsMade array
	//check for latlng key in req.body, if there is, store it in the dish; if not, get latlng from user & store in dish
	//TODO: add regex control
	app.post('/newdish', function(req, res, next){
		var data = req.body;
		var errors = [];
		var warnings = [];

		if (!data.uid) {
			res.send({
				errors: [{
					errorType	: "uid",
					errorMessage: "You didn't send the userid."
					}],
				madeMeal: true
			});
			return;
		}
		
		var dishObject = {
			dateUpdated	: Date(),
			ownerid		: data.uid
		};
		
		//check if dishName is present and valid
		if (!data.dishName) {
			errors.push({
				errorType	: "dishName",
				errorMessage: "No dish name submitted."
			});
		} else if (!globals.dishNameRegex.test(data.dishName)){
			errors.push({
				errorType	:"dishName",
				errorMessage: "Invalid characters in dish's name."
			});
		} else {
			dishObject.dishName = data.dishName;
		}
		
		//check if location is present and valid
		if (!data.location) {
			errors.push({
				errorType	: "location",
				errorMessage: "You didn't send the location"
			});
		//} else if (!globals.addressRegex.test(data.location)){
		//	errors.push({
		//		errorType	: "location",
		//		errorMessage: "Invalid characters in location"
		//	});
		} else {
			dishObject.location = data.location.name;
			dishObject.lat = data.location.lat;
			dishObject.lng = data.location.lng;
			
		}
		
		//check if description is present and valid
		if (!data.description) {
			warnings.push({
				warningType		: "description",
				warningMessage	: "No description entered"
			});
			dishObject.description = "";
		} else if (!globals.commentRegex.test(data.description)){
			warnings.push({
				warningType		: "description",
				warningMessage	: "Invalid characters in description"
			});
		} else {
			dishObject.description = data.description;
		}
		
		//check if price is present and valid
		if (!data.price) {
			errors.push({
				errorType	: "price",
				errorMessage: "No price entered"
			});
		} else if (!globals.priceRegex.test(data.price)){
			errors.push({
				errorType	: "price",
				errorMessage: "Invalid characters in price"
			});
		} else {
			dishObject.price = data.price;
		}
		
		var start;
		var end;
		//check if time is entered, regex not added yet bc I want to further change the time input
		//into a period of time as well as only store year/month/day/hour/min
		if (!data.time) {
			errors.push({
				errorType		: "time",
				errorMessage	: "No time entered"
			});
		} else {
			//time object: has year, month, day, 
			start = new Date(req.body.time.year, req.body.time.month, req.body.time.day, req.body.time.startHour, req.body.time.startMin, 0);
			end = new Date(req.body.time.year, req.body.time.month, req.body.time.day, req.body.time.endHour, req.body.time.endMin, 0);
			console.log(start);
			console.log(end);
			dishObject.time = {
				startTime: start,
				endTime: end
			};
		}
		
		//check if portions is entered, if not, set at 1
		if (!data.portions) {
			warnings.push({
				warningType		: "portion",
				warningMessage	: "No portion entered, default is at 1"
			});
			dishObject.portion = 1;
		} else if (!globals.onlyIntsRegex.test(data.portions)){
			errors.push({
				errorType		: "portion",
				errorMessage	: "Invalid characters in prportionice"
			});
		} else {
			dishObject.portion = data.portions;
		}
		
		//check if ingredients are there
		//check regex later cuz I didn't write it yet
		if (!data.ingredients) {
			warnings.push({
				warningType: "ingredients",
				warningMessage: "no ingredients entered"
			});
			dishObject.ingredients = "Please ask cook";
		} else {
			dishObject.ingredients = data.ingredients;
		}
		
		//if no errors, then continue
		if (errors.length > 0 ){
			res.send({
				errors: errors,
				message: "Not updated due to errors",
				madeMeal: true
			});
			return;
		}
		
		dishObject.active = true;
		
		//go and make a new dish under "dish" in db
		var newDishRef = global.dishRef.push();
		var newDishKey = newDishRef.key;
		
		console.log(dishObject);
		newDishRef.set(dishObject);
		global.dishRef.child(newDishKey).update({
		    time: {
		        startTime: start,
		        endTime: end   
		    }
		});
            
        console.log(start);
        console.log(end);
        
		global.userRef.child(req.body.uid).once("value", function(snapshot){
			console.log(snapshot.val());
			var meals;
			if (!snapshot.val().mealsMade){
				meals = [newDishKey];
			} else {
				meals = snapshot.val().mealsMade;
				meals.push(newDishKey);
			}
			console.log("Meals Made: " + meals);
			global.userRef.child(req.body.uid).update({
				"mealsMade": meals
			});

			// global.dishRef.child(newDishKey).once("value", function(snapshot){
			// 	console.log(snapshot.val().firstName);	
			// });
			
			newDishRef.update({
				"owner": snapshot.val().firstName || "No Firstname Yet",
				"phone": snapshot.val().phone || "Uhoh, this user has not updated his/her phone number yet"
			});
			
		});
		res.send({
			errors: errors,
			warnings: warnings,
			message: "You've successfully submitted the meal!",
			madeMeal: true
		});
		
		//update user's mealsMade
	});
	
	//to edit a dish; checks for invalid characters and not present info
	app.post('/api/dish/edit', function(req, res){
		//if no uid sent, return error
		if (!req.body.uid) {
			res.send({
				errorType: "uid",
				errorMessage: "No uid sent"
			});
			return;
		}

		//if no uid sent, return error
		if (!req.body.key) {
			res.send({
				errorType: "key",
				errorMessage: "No dishkey sent"
			});
			return;
		}
		
		if (!req.body.active && !req.body.dishName && !req.body.location && !req.body.phone && !req.body.description && 
			!req.body.price  && !req.body.time	   && !req.body.portion && req.body.lng	   && !req.body.lat) {
			res.send({
				errorType: 'content',
				errorMessage: "There's nothing to change"
			});
			return;
		}
		
		var data = req.body;
		var update = {};
		var error = [];
		var warnings = [];
		
		if (data.active === true || data.active === false) {
			update.active = data.active;
		}
		
		if (data.dishName) {
			if (globals.dishNameRegex.test(data.dishName)){
				update.dishName = data.dishName;
			} else {
				error.push({
					errorType: "dishName",
					errorMessage: "invalid characters in dishName"
				});
			}
		}
		
		if (data.location) {
			//if (globals.addressRegex.test(data.location)){
				update.location = data.location;
			//} else {
			//	error.push({
			//		errorType: "location",
			//		errorMessage: "invalid characters in location"
			//	});
			//}
		}

		if (data.phone) {
			if (globals.phoneRegex.test(data.phone)){
				update.phone = data.phone;
			} else {
				error.push({
					errorType: "phone",
					errorMessage: "invalid characters in phone"
				});
			}
		}
		
		if (data.description) {
			if (globals.commentRegex.test(data.description)){
				update.description = data.description;
			} else {
				warnings.push({
					warningType	: "description",
					warningMessage: "invalid characters in description"
				});
				update.description = "";
			}
		}
		
		if (data.price) {
			if (globals.priceRegex.test(data.price)){
				update.price = data.price;
			} else {
				error.push({
					errorType: "price",
					errorMessage: "invalid characters in price"
				});
			}
		}
		
		if (data.time) {
			update.time = data.time;
		}
		
		if (data.portion) {
			if (globals.onlyIntsRegex.test(data.portion)){
				update.portion = data.portion;
			} else {
				error.push({
					warningType: "portion",
					warningMessage: "invalid characters in portion"
				});
				update.portion = 1;
			}
		}
		
		if (data.lng & data.lat) {
			if (globals.latLngRegex.test(data.lng) && globals.latLngRegex.test(data.lat)){
				update.lng = data.lng;
				update.lat = data.lat;
			} else {
				error.push({
					errorType: "latlng",
					errorMessage: "invalid characters in latlng"
				});
			}
		}
		
		update.dateUpdated = Date();
		
		global.dishRef.child(data.key).once("value", function(snapshot){
			if (snapshot.val().ownerid !== data.uid) {
				res.send({
					errorType: "dishkey",
					errorMessage: "dish in question does not belong to you"
				});
				return;
			} else {
				global.dishRef.child(data.key).update(update);
				res.send({
					error: error,
					warnings: warnings,
					message: "updated"
				});
			} 	
		});
		
		
	});
	  
};