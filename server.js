var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var firebase = require('firebase');
var sassMiddleware = require('node-sass-middleware');
var path = require('path');
var static = require('./controllers/static.controller');

firebase.initializeApp({
  serviceAccount: "./configs/firebase.json",
  databaseURL: "https://angular-project-31b5c.firebaseio.com/"
});

var db = firebase.database();
global.rootRef = db.ref("firebase_test");
app.set("view engine", "ejs");

var serverLogging = function(req, res, next){
	console.log(req.method, req.url);
	next();
};

app.use(sassMiddleware({
    src: __dirname + '/public/css',
    dest: __dirname + '/public/css',
    debug: true,
    outputStyle: 'compressed'
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(serverLogging);
app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "ejs");

static(app);

app.get('/', function(req, res){
    res.send("Hi from Cheryl; go to /about & /advertisements");
    //var usersRef = global.rootRef.child("users");
    //got try-throw-catch this so app doesn't crash; but connected to DB
    // usersRef.set({
    //     alanisawesome: {
    //         date_of_birth: "June 23, 1912",
    //         full_name: "Alan Turing"
    //         },
    //     gracehop: {
    //         date_of_birth: "December 9, 1906",
    //         full_name: "Grace Hopper"
    //     }
    // });
});


process.env.PORT = process.env.PORT || 80;

app.listen(process.env.PORT, function(){
    console.log("running on " + process.env.PORT);
});