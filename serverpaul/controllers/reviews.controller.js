var globals = require('../configs/globals');

var verifyRating = function(number){
    var rating = parseInt(number, 10);
    if (!rating){
        return -1;
    } else if (rating < 0 || rating > 5 ){
        return -1;
    } else {
        return rating;
    }
};

module.exports = function(app){
    
    //endpoint for reviewing a chef, save dishid, dishName & description & date
    //review metrics:
        //ratings: taste, timing, value
        //review: free for all answer
    //review has type 'chef' or 'buyer'
    //store review as a separate object, but link a reference of it to the reviewer & reviewee
    //once finishes reviewing someone, dish should be moved to a pastPurchases list
    //once all buyers reviews a dish or 2 days has past since the dish was 'ready', put dish in a pastMade list
    app.post('/api/reviewChef', function(req, res){
        console.log("received request");
        console.log(req.body);
        if (!req.session){
            res.send("invalid");
            return;
        }
        if (!req.session.uid || !req.body.dishid || !req.body.rating){
            res.send("invalid");
            return;
        }
        
        var errors = [];
        //check that reviewer purchased the meal
        global.userRef.child(req.session.uid).once('value').then(function(snapshot){
            console.log("fetched data from userRef");
            if (!snapshot.val()){
                errors.push({
                    errorType: "uid",
                    errorMessage: "invalid uid"
                });
            } else if (!snapshot.val().activeMeals){
                errors.push({
                    errorType: "purchases",
                    errorMessage: "purchase does not exist"
                });
            } else {
                var activeMeals = snapshot.val().activeMeals;
                if (!activeMeals[req.body.dishid]){
                    errors.push({
                        errorType: "purchases",
                        errorMessage: "User didn't purchase meal"
                    });
                } else if (!activeMeals[req.body.dishid]["pickedUp"]){
                    errors.push({
                        errorType: "review",
                        errorMessage: "cannot review dish before picking up"
                    });
                } else if (activeMeals[req.body.dishid]["reviewedChef"]){
                    errors.push({
                        errorType: "review",
                        errorMessage: "already reviewed dish"
                    });
                }
            }
            
            var pastMeals = {};
            if (snapshot.val().pastMeals) pastMeals = snapshot.val().pastMeals;
            
            
            //verify ratings are integers between 0 and 5
            if (verifyRating(req.body.rating) === -1){
                errors.push({
                    errorType: "rating",
                    errorMessage: "ratings not valid numbers"
                });
            }
            
            //if there is a review, verify that it's valid
            if (req.body.review){
                console.log(req.body.review);
                // console.log(globals.commentRegex(req.body.review));
                // if (!globals.commentRegex(req.body.review)){
                //     errors.push({
                //         errorType: 'review',
                //         errorMessage: "invalid characters in review"
                //     });
                // }
            }
            
            if (errors.length){
                console.log(errors);
                res.send("invalid request");
                return;
            }
            console.log("hi");
            var reviewsForChef = [];
            if (snapshot.val().reviewsForChef) {
                reviewsForChef = snapshot.val().reviewsForChef;
            }
            
            //verify dish
            global.dishRef.child(req.body.dishid).once("value").then(function(snapshot){
                if (!snapshot.val()){
                    errors.push({
                        errorType: 'dish',
                        errorMessage: 'invalid dishid'
                    });
                } else if (!snapshot.val().purchases){
                    errors.push({
                        errorType: 'purchases',
                        errorMessage: 'no purchases made under your name'
                    });
                } else {
                    var purchases = snapshot.val().purchases;
                    if (!purchases[req.session.uid]){
                        errors.push({
                            errorType: "purchases",
                            errorMessage: "no purchases made under your name"
                        });
                    } else if (!purchases[req.session.uid]["pickedUp"]){
                        errors.push({
                            errorType: "review",
                            errorMessage: "cannot review chef before picking up the meal"
                        });
                    } else if (purchases[req.session.uid]["reviewedChef"]){
                        errors.push({
                            errorType: "review",
                            errorMessage: "cannot review twice"
                        });
                    }
                
                }
                if (errors.length){
                    res.send("invalid request");
                    console.log(errors);
                    return;
                }
                console.log("chefid");
                var chefid = snapshot.val().ownerid;
                //make rating object and store it
                var rating = {
                    rating: verifyRating(req.body.rating),
                    dish: {
                        dishid: req.body.dishid,
                        chefid: snapshot.val().ownerid,
                        buyerid: req.session.uid
                    },
                    date: new Date()
                };
                console.log("rating");
                console.log(rating);
                
                if (req.body.review) {
                    rating.review = req.body.review;
                }
                
                var newChefReviewRef = global.chefReviewRef.push();
                var newChefReviewKey = newChefReviewRef.key;
                newChefReviewRef.set(rating);
                
                reviewsForChef.push(newChefReviewKey);
                //save to list of reviews given to chefs
                global.userRef.child(req.session.uid).update({
                    reviewsForChef: reviewsForChef
                });
                
                //remove the dishid from activeMeals and move it to a new node called pastMeals
                var pastMeal = activeMeals[req.body.dishid];
                var dishid = req.body.dishid;
                pastMeal.reviewedChef = true;
                pastMeal.reviewForChef = newChefReviewKey;
                
                pastMeals[dishid] = pastMeal;
                
                
                
                
                //update the dish listings to reflect that person has reviewed the chef
                global.userRef.child(req.session.uid).update(
                    {pastMeals});
                
                global.userRef.child(req.session.uid).child("activeMeals").child(req.body.dishid).remove();
                
                purchases[req.session.uid].reviewedChef = true;
                purchases[req.session.uid].reviewForChef = newChefReviewKey;
                global.dishRef.child(req.body.dishid).update({purchases: purchases});
                
                //save for the chef who's been reviewed
                global.userRef.child(chefid).once("value").then(function(snapshot){
                    if (snapshot.val()){
                        var reviewsAsChef = [];
                        if (snapshot.val().reviewsAsChef) {
                            reviewsAsChef = snapshot.val().reviewsAsChef;
                        }
                        reviewsAsChef.push(newChefReviewKey);
                        global.userRef.child(chefid).update({
                            reviewsAsChef: reviewsAsChef
                        });
                        res.send("success");
                        return;
                    }
                }, function(err){
                    res.send("invalid request");
                });
                
            }, function(err){
                res.send("invalid request");
            });
            
        }, function(err){
            res.send("invalid request");
        });
    });
    
    //review the buyer
    app.post('/api/reviewBuyer', function(req, res){
        console.log(req.body);
        var errors = [];
        if (!req.session){
            res.send("invalid request");
            return;
        }
        if (!req.session.uid || !req.body.buyerid || !req.body.dishid || !req.body.rating){
            res.send("invalid request");
            return;
        }
        
        var rating = verifyRating(req.body.rating, 10);
        if (rating === -1){
            errors.push({
                errorType: "rating",
                errorMessage: "invalid rating format"
            });
        }
        
        //verify that owner has cooked dish 
        global.userRef.child(req.session.uid).once("value").then(function(snapshot){
            //if snapshot.val() isn't null
            
            if (!snapshot.val()){
                errors.push({
                    errorType: "uid",
                    errorMessage: "invalid uid"
                });
            } else if (!snapshot.val().currentlyCooking) {
                errors.push({
                        errorType: "dish",
                        errorMessage: "user didn't post this dish"
                });
            } else if (snapshot.val().currentlyCooking.indexOf(req.body.dishid) === -1){
                errors.push({
                    errorType: "dish",
                    errorMessage: "user didn't post this dish"
                });
            }
            
            if (errors.length) {
                res.send("invalid request");
                console.log(errors);
                return;
            }
            
    
            var reviewsForBuyer = [];
            if (snapshot.val().reviewsForBuyer) reviewsForBuyer = snapshot.val().reviewsForBuyer;
            
            //note that buyer doesn't necessarily have the dishid under activeMeals, because once buyer reviews chef, it moves to pastMeals
            global.dishRef.child(req.body.dishid).once("value").then(function(snapshot){
                var purchases;
                if (!snapshot.val()){
                    errors.push({
                        errorType: "dish",
                        errorMessage: "dish doesn't exist"
                    });
                } else if (!snapshot.val().purchases) {
                    errors.push({
                        errorType: "dish",
                        errorMessage: "buyer didn't purchase  dish"
                    });
                } else{
                    purchases = snapshot.val().purchases;
                    if (!purchases[req.body.buyerid]){
                        errors.push({
                            errorType: "dish",
                            errorMessage: "buyer didn't purchase this dish"
                        });
                    } else if (!purchases[req.body.buyerid]["pickedUp"]){
                        errors.push({
                            errorType: "pickup",
                            errorMessage: "cannot review buyer before s/he picked up dish"
                        });
                    } else if (purchases[req.body.buyerid]["reviewedBuyer"]){
                        errors.push({
                            errorType: "review",
                            errorMessage: "cannot review twice"
                        });
                    }
                }
                
                
                if (errors.length){
                    res.send("invalid request");
                    console.log(errors);
                    return;
                }
                
                //save review to buyerReviews
                var ratingObj = {
                    rating: rating,
                    date: new Date(),
                    dish: {
                        buyer: req.body.buyerid,
                        chef : req.session.uid,
                        dishid: req.body.dishid
                    }
                };
                
                
                if (req.body.review){
                    ratingObj.review = req.body.review;
                }
                
                console.log(ratingObj);
                
                var newBuyerReviewRef = global.buyerReviewRef.push();
                var newBuyerReviewKey = newBuyerReviewRef.key;
                newBuyerReviewRef.set(ratingObj);
                
                //store the id for the newBuyerReivewRef to the reviewer & reviewee
                reviewsForBuyer.push(newBuyerReviewKey);
                global.userRef.child(req.session.uid).update({
                    reviewsForBuyer: reviewsForBuyer
                });
                
                //change reviewedBuyer & reviewForBuyer
                purchases[req.body.buyerid].reviewedBuyer = true;
                purchases[req.body.buyerid].reviewForBuyer = newBuyerReviewKey;
                
                console.log(purchases);
                global.dishRef.child(req.body.dishid).child("purchases").set(purchases);
                console.log("hi");
                
                global.userRef.child(req.body.buyerid).once("value").then(function(snapshot){
                    if (snapshot.val()){
                        var reviewsAsBuyer = [];
                        if (snapshot.val().reviewsAsBuyer) reviewsAsBuyer = snapshot.val().reviewsAsBuyer;
                        reviewsAsBuyer.push(newBuyerReviewKey);
                        global.userRef.child(req.body.buyerid).update({
                            reviewsAsBuyer: reviewsAsBuyer
                        });
                        
                        var activeMeals = snapshot.val().activeMeals;
                        var pastMeals = snapshot.val().pastMeals;
                        //if buyer hasn't reviewed chef yet, meal still in buyer's activeMeals
                        if (activeMeals[req.body.dishid]){
                            activeMeals[req.body.dishid].reviewedBuyer = true;
                            activeMeals[req.body.dishid].reviewForBuyer = newBuyerReviewKey;
                            global.userRef.child(req.body.buyerid).child("activeMeals").update(activeMeals);
                            res.send("success");    
                        } else if (pastMeals[req.body.dishid]){
                            pastMeals[req.body.dishid].reviewedBuyer = true;
                            pastMeals[req.body.dishid].reviewForBuyer = newBuyerReviewKey;
                            global.userRef.child(req.body.buyerid).child('pastMeals').update(pastMeals);
                            res.send("success");
                        }
                        
                        
                    }    
                }, function(err){
                    res.send({
                        errorType: 'firebase',
                        errorMessage: err
                    });
                    return;
                });
                
                
            }, function(err){
                res.send({
                    errors: [{
                        errorType: "firebase",
                        errorMessage: err
                    }]
                });
                return;
            }); //end retrieve data from firebase dishRef
            
        }, function(err){
            res.send({
                errors: [{
                    errorType: "firebase",
                    errorMessage: err
                }]
            });
            return;
        }); //end retrieve data from firebase userRef
    }); //end POST /api/reviewChef
};