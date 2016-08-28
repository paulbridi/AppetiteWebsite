//this will be the parent controller, with things like uid, verifications, etc
//user
var parentController = ['$timeout', '$scope', 'sessionService', function($timeout, $scope, sessionService) {
    $scope.parentController = {
        dish: {}
    };
    
    $scope.parentController.signout = sessionService.signout;
    
    
    //if the person is logged in, get that person's info
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            //put info about user into scope
            $timeout(function() {
                $scope.parentController.user = {
                    uid             : user.uid,
                    emailVerified   : user.emailVerified,
                    email           : user.email
                };
                $scope.parentController.uid = user.uid;
            });
            
            //retrieve person's info, autoreferesh if anything changes
            firebase.database().ref('users/' + user.uid).on('value', function(snapshot){
                //check for null/undefined
                if (snapshot.val()){
                    //store things in the parentController, an error for location if it's not filled out
                    
                    $scope.parentController.user = snapshot.val();
                    $scope.emailVerified = user.emailVerified; 
                    $scope.parentController.dish.location = {
                        name: snapshot.val().location,
                        lat: snapshot.val().lat,
                        lng: snapshot.val().lng,
                        error: undefined
                    };
                    $scope.parentController.activeMeals = snapshot.val().activeMeals;
                    $scope.parentController.currentlyCooking = snapshot.val().currentlyCooking;
                    console.log($scope.parentController);
                        
                    if (!snapshot.val().lng){
                        $scope.parentController.dish.location.error = "Please fill out your address before posting a dish!";
                    }
                    
                    $scope.parentController.user.firstName  = snapshot.val().firstName;
                    $scope.parentController.user.lastName  = snapshot.val().lastName;
                    $scope.parentController.user.photoUrl   = snapshot.val().photoUrl;
                    $scope.parentController.user.phone      = snapshot.val().phone;
                }
            }); //end fetch user data from firebase 
        }else{
            $timeout(function() {
                $scope.parentController.user = undefined;
                $scope.parentController.uid = undefined;
                console.log("no user");
                
            });
        }
    }); //end auth function
}];