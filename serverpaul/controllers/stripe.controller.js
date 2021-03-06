var stripe = require('../models/stripe.model');
var globals = require('../configs/globals');

module.exports = function(app){
    
    //function called to create stripe account
    //req.body must contain agreement to tos, dob of person, and legal firstName / lastName
    app.post('/api/createStripeAccount', function(req, res){
        //check that required elements are put in, expect tos acceptance
        var timeNow = new Date();
        var tosIp;
        console.log(req.body);
        if (!req.body.day || !req.body.month || !req.body.year || !req.body.firstName || !req.body.lastName){
            res.send("invalid request");
            console.log("Create Stripe Account fail: missing info from request - " + timeNow.toDateString());
            return;
            
        //check that day, month, and year are integers and are in the correct range
        } else if (!Number.isInteger(req.body.day) ||req.body.day <=0 || req.body.day >31 || !Number.isInteger(req.body.month) || !Number.isInteger(req.body.year) || req.body.month <=0 || req.body.month >=13 || req.body.year <=1900 || req.body.year >= timeNow.getFullYear()){
            res.send("invalid request");
            console.log("Create Stripe Account fail: dob have invalid characters - " + timeNow.toDateString());
            console.log(req.body.year <=1900);
            console.log( req.body.year >= timeNow.getFullYear());
            
            return;
            
            //check that the firstName & lastName have valid regex
        } else if (!globals.individualNameRegex.test(req.body.firstName) || !globals.individualNameRegex.test(req.body.lastName)){
            res.send("invalid request");
            console.log("Create Stripe Account fail: legal name have invalid characters - " + timeNow.toDateString());
            return;
        } else if (req.body.tos !== true) {
            res.send("invalid request");
            console.log("Create Stripe Account fail: tos acceptance - " + timeNow.toDateString());
            return;
        }
        tosIp = req.connection.remoteAddress;
        var dob = {
            day: req.body.day,
            month: req.body.month,
            year: req.body.year
        };
        
        
        
        if (req.session){
            if (req.session.uid){
                if (!req.session.emailVerified ){
                    res.send("Email not verified");
                    return;
                } else {
                    console.log("create Stripe account");
                    stripe.createNewStripeAccount(req.session.uid, dob, req.body.firstName, req.body.lastName, tosIp, function(account){
                        if (account){
                            res.send("success");
                            console.log(account);
                            return;
                        } else {
                            res.send("invalid request");
                            console.log("Create Stripe Account fail: stripe - " + timeNow.toDateString());
                            return;
                        }
                    });
                }
            } else {
                console.log("Create Stripe Account fail: no session - " + timeNow.toDateString());
                res.send("invalid request");
            }
        } else {
            console.log("Create Stripe Account fail: no session - " + timeNow.toDateString());
            res.send("invalid request");
        }
        

    });
    
    app.post('/api/getMyAccount', function(req, res){
        if (!req.session){
            res.send("invalid request");
            return;
        } else if (!req.session.uid){
            res.send("invalid request");
            return;
        }
        
        console.log("got request");
        if (req.session.uid){
            //find the accountId of the person, if s/he has one, 
            global.sensitiveUserRef.child(req.session.uid).once("value", function(snapshot){
                if (!snapshot.val()) {
                    res.send("invalid request");
                } else if (!snapshot.val().stripe){
                    res.send("invalid request");
                } else if (snapshot.val().stripe.id){
                    //call the getAccountByAccountId function on stripe and pass function to process returned account on it
                    stripe.getAccountByAccountId(req.body.accountNum, function(account){
                        if (account){
                            console.log("got account");
                            console.log(account);
                            res.send(account);
                        } else {
                            console.log("failed to retrieve data from stripe");
                            res.send("invalid request");
                        }    
                    }); //end stripe getAccountByAccountId function
                } else {
                    res.send("invalid request");
                }
            });
        }
    }); //end POST /api/getMyAccount
    
    //update address for stripe
    app.post("/api/updateStripeAddress", function(req, res){
        var timeNow = new Date();
        //check that person is signed in
        if (!req.session.uid){
            res.send("invalid request");
            console.log("Update Stripe Address fail: no session - " + timeNow.toDateString());
            return;
        } 
        if (!req.body.city || !req.body.addLine1 || !req.body.postal || !req.body.state){
            res.send("invalid request");
            console.log("Update Stripe Address fail: incomplete info - " + timeNow.toDateString());
            return;
        } 
        var addLine2 = req.body.addLine2 || undefined;
        stripe.updateAccountAddress(req.body.city, req.body.addLine1, addLine2, req.body.postal, req.body.state, req.session.uid, function(account){
                if (account === 0){
                    res.send("invalid request");
                } else {
                    res.send(account);
                    console.log("Update Stripe Address success for " + req.session.uid + " at " + timeNow.toDateString());
                }
                
        });
    }); //end post /api/updateStripeAddress
    
    app.post('/api/updateStripePersonalId', function(req, res){
        if (!req.session.uid){
            res.send("invalid request");
            return;
        }
        console.log(req.body.response);
        if (req.body.response.error){
            res.send("invalid resposne");
            return;
        }
        global.sensitiveUserRef.child(req.session.uid).once("value").then(function(snapshot){
            //cannot set pii if the user doesn't have a stripe managed account or already have a pii number
            if (!snapshot.val()){
                res.send("invalid request");
                return;
            }
            if (!snapshot.val().stripe){
                res.send('invalid request');
                return;
            }
            if (snapshot.val().stripe.pii){
                res.send("invalid request");
                return;
            }
            var accountid = snapshot.val().stripe.id;
            stripe.updateStripePersonalId(accountid, req.body.response.id, req.session.uid, function(responseCode){
                console.log(responseCode);
                if (responseCode!== 0){
                    global.sensitiveUserRef.child(req.session.uid).child("stripe").update({
                        pii: req.body.response.id
                    });  
                    res.send("success"); 
                } else {
                    res.send("invalid request"); 
                }
            });
            
        }, function(err){
            res.send('invalid request');
        });
    }); //end post /api/updateStripePersonalId

    
};