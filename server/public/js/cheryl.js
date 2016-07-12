/* global angular*/
/* global firebase*/
/* global google*/
var myApp = angular.module('myApp', ['ngRoute']);

myApp.config(['$routeProvider', function($routeProvider){

//testing to see if this works
$routeProvider

  .when('/', {
    templateUrl: '/home',
    controller: 'homeController'
  })
  .when('/account', {
      templateUrl: '/account',
      controller: 'accountController'
  })
  .when('/browse', {
      templateUrl: '/browse',
      controller: 'browseController'
  })
  .when('/aboutus', {
      templateUrl: '/aboutus'
  })
  .when('/terms', {
      templateUrl: '/terms'
  })
  .otherwise({
    redirectTo: '/'
  });

}]);



//for controlling regex, to be addedS
myApp.service('regexService', function(){
    this.onlyIntsRegex    = /^[0-9]+$/;
    this.phoneRegex       = /^(\()?\d{3}(\))?(-|\s)?\d{3}(-|\s)\d{4}$/;
    this.usernameRegex    = /^[a-zA-Z0-9]+$/;
    this.passwordRegex    = /^[a-zA-Z0-9:.?!@#$%^&*\-=_+\'\";<>,\/]+$/;
    this.individualNameRegex = /^[\w\d]+$/i;
    this.commentRegex     = /^[\w\d.,:;"'-=_+!@#$%^&*0-9 ]+$/i;
    this.mealRegex        = /^[\w\d.,:;"'-=_+!@#$%^&*0-9 ]+$/i;
    this.addressRegex        = /^[\w\d.,:;"'-=_+!@#$%^&*0-9 ]+$/i;
    this.latLngRegex      = /^-?[0-9]{1,3}\.?[0-9]{0,}$/;
    this.priceRegex       = /^\$?[0-9]+\.?[0-9]{0,}$/;
    this.emailRegex       = /[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
});

//login, signup
myApp.controller('homeController', function($scope, $log, $location, regexService, $route) {
    $scope.user = {};
    $log.log("Connected");
    $scope.warnings = [];
    
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            $log.log("onAuthStateChanged: ");
            $log.log(user);
            $scope.currentUser = user;
            $scope.warnings.push({
                errorType: "user",
                errorMessage: "Already logged in with " + user.email
            });
        } else {
            $log.log("onAuthStateChanged: no user");
        }
    });
    
    $scope.$watch('user.password', function(newValue, oldValue){
        if (newValue.keyCode == 13) $scope.login($scope.user);
    });
    
    //user can submit signup form by typing ENTER into the confim password box, but only if the two passwords match
    $scope.$watch('user.confirmpassword', function(newValue, oldValue){
        if (oldValue.keyCode == 13 && $scope.user.signuppassword === $scope.user.confirmpassword) {
            $scope.signup($scope.user);
        }
    });
    
    //function for logging in, once successfully logged in, redirect to /browse
    $scope.login = function(user) {

        $log.log("login with email: " + user.email);
        
        firebase.auth().signInWithEmailAndPassword(user.email, user.password).then(
            function(){
                $log.log("login function resolved");
                $log.log(firebase.auth().currentUser);
                $route.reload();
                $location.path("/browse");
            }
            ,function(error) {
                $scope.warnings.push({
                    errorType   : "login",
                    errorMessage: error.message
                });
            });

    };
    
    //after successfully creating a new user: create node in users/, and redirect to /account to fill more info
    $scope.signup = function(user){
        console.log("signup");
        
        firebase.auth().createUserWithEmailAndPassword(user.signupemail, user.signuppassword).then(
            function(){
                $log.log("signup resolved");
                var user = firebase.auth().currentUser;
                firebase.database().ref('users/' + user.uid).set({
                    email: user.signupemail 
                });
                $log.log(firebase.auth().currentUser);
                $location.path('/account');
            },
            function(error) {
        // Handle Errors here. omg why isn't this code running...
            var errorCode = error.code;
            var errorMessage = error.message;
            console.log(errorCode + ": " + errorMessage);
            $scope.warnings.push({
                errorType   : "signup",
                errorMessage: error.message
            });
        });
      
    };

});




//if user is logged in, make ajax request to fetch stuff
myApp.controller('accountController', function($scope, $log, $location, $http){
    var firebaseUser = firebase.auth().currentUser;
    $scope.user = firebaseUser;
    
    //if no one is logged in, then redirect to the login page
    if (!$scope.user) {
        $location.path('/');
        return;
    }
    
    //getting the user's info and the user's dishes info
    firebase.database().ref('users/' + $scope.user.uid).once('value', function(snapshot){
        $log.log(snapshot.val());
        $scope.$apply(function(){
            $scope.user.firstName = snapshot.val().firstName;
          $scope.user.lastName = snapshot.val().lastName;
          //$scope.user.email = snapshot.val().email;
          $scope.user.phone = snapshot.val().phone;
          $scope.user.address = snapshot.val().address;
          $scope.user.mealsMade = [];
          //should go and fetch meals
          if (snapshot.val().mealsMade){
                snapshot.val().mealsMade.forEach(function(mealId){
                  firebase.database().ref('dish/' + mealId).once('value', function(snapshot){
                      snapshot.val().mealId = mealId;
                      
                          $scope.user.mealsMade.push(snapshot.val());
                      
                           
                  });
              });             
          }


                  });
    });
    
    
    //posts stuff to backend to edit profile
    $scope.editProfile = function(user){
        $http.post('/api/account/edit', {
            fname: user.firstName,
            lname: user.lastName,
            phone: user.phone,
            address: user.address,
            uid: $scope.user.uid
        })
        .then(function(data){
            //should use a ng-model to let user know success on success, maybe the ng-rules thingy
            console.log(data);
        },
        function(err){
           console.log(err); 
        });
    };
    
    
    //note: must have these things when injecting
    $scope.editDish = function(dish){
        $http.post('/api/dish/edit', {
            key         : dish.key,
            delete      : dish.delete,
            dishName    : dish.dishName,
            address     : dish.address,
            uid         : $scope.user.uid,
            description : dish.description,
            price       : dish.price,
            time        : dish.time,
            portions    : dish.portions
        })
        .then(function(data){
            console.log(data);
        },
        function(err){
            console.log(err);
        });
    };
    
    
    
    

});



myApp.controller('browseController', function($scope, $log, $location, $http){
    
    //if user isn't logged in, then go to home
    //ask for a promise here, or use $cookie
    if(!firebase.auth().currentUser) {
        $location.path('/');
        return;
    }

    $scope.dishes = [];
    $scope.markers = [];
    
    firebase.database().ref('dish/').orderByChild("dataAdded").once("value", function(snapshot){
        var allDishes = snapshot.val();
        $log.info(allDishes);
        for (var key in allDishes){
            if (!allDishes[key]["deleted"] & allDishes[key]["ownerid"] !== firebase.auth().currentUser.uid){
                //console.log("ownerid if");
                //console.log(allDishes[key]);
                //go find the owner's phone & address
                //firebase.database().ref('users/' + firebase.auth().currentUser.uid).once('value', function(snapshot){
                //    console.log("before scope.apply");
                //    console.log(allDishes[key]);
                //    console.log(snapshot.val());
                    $scope.$apply(function(){
                        $scope.dishes.unshift({
                            dishName    : allDishes[key]["dishName"],
                            description : allDishes[key]["description"],
                            price       : allDishes[key]["price"],
                            quantity    : allDishes[key]["quantity"],
                            time        : allDishes[key]["time"],
                            address     : allDishes[key]["address"],
                            owner       : allDishes[key]["owner"],
                            key         : key,
                            phone       : snapshot.val().phone
                        });
                    });
                    
                    
                //}); //end $scope.$apply
            } //end if  
        } // end forEach loop
        
    });
    
    
    //create a dish object and put the user's info into it
    $scope.dish = {
        warnings: [],
        errors  : []
    };
    firebase.database().ref('users/' + firebase.auth().currentUser.uid).once('value', function(snapshot){
        //if user has phone num, then use that as the dish's phone num
        //else, error and cannot submit dish
        if (snapshot.val().phone) {
            $scope.dish.phone = snapshot.val().phone;
        } else {
            $scope.dish.errors.push({
                errorType: "userinfo",
                errorMessage: "User info incomplete: missing phone number"
            });
        }
        
        //if user has valid address & lnglat, then use that as the dish's address & lnglat
        //else, error and cannot submit dish
        if (snapshot.val().address && snapshot.val().lng && snapshot.val().lat) {
            $scope.dish.address = snapshot.val().address;
            $scope.dish.lat     = snapshot.val().lat;
            $scope.dish.lng     = snapshot.val().lng;
        } else {
            $scope.dish.errors.push({
                errorType: "userinfo",
                errorMessage: "User info incomplete: missing address, lat & lng"
            });
        }
        
        
        
    });
    
    
    
    //submits a dish
    //on success, clear stuff and show div that says submitSuccess and go to manage
    //on fail, show div that warns that submission failed
    $scope.submitDish = function(dish){
        if (!firebase.auth().currentUser){
            $location.path('/');
            return;
        }
        var uid = firebase.auth().currentUser.uid;
        var date = new Date();
        $http.post('/newdish', {
            dishName    : dish.dishName,
            location    : dish.location,
            uid         : uid,
            description : dish.description,
            price       : dish.price,
            time        : {
                    year    : date.getFullYear(),
                    month   : date.getMonth(),
                    day     : dish.day || date.getDate(),
                    start   : dish.starttime,
                    end     : dish.endtime
                },
            portions    : dish.portions || 1,
            ingredients : dish.ingredients || ""
        })
        .then(function(res){
            $log.log(res);
            if (res.status === 200) {
                $scope.submitSuccess = true;
                dish.dishName = "";
                dish.description = "";
                dish.price = "";
                dish.month = "";
                dish.year = "";
                dish.day = "";
                dish.starttime = "";
                dish.endtime = "";
                dish.portions = "";
                dish.location = "";
                dish.ingredients = "";
                    $scope.error = res.data.error;
                    $scope.warnings = res.data.warnings;
                    $scope.message = res.data.message;    
                $log.log($scope.error);
                $log.log(res.data);
                
            } else {
                $log.log(res.status);
            }
        }, function(err){
            console.log(err);
            $scope.error = "Failed to load data, please refresh page";
        });
    };
    
});
