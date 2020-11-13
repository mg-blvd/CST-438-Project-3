var express = require('express');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var request = require('request');
var app = express();

var session = require('express-session');
var bcrypt = require('bcrypt');

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride('_method'));

/* SESSION */
app.use(session({
    secret: 'top secret code!', //doesn't matter what this says
    resave: true,
    saveUninitialized: true
}));
app.set('view engine', 'ejs');



const connection = mysql.createConnection({
    host: process.env.HOST, //local
    user: process.env.USERNAME,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    multipleStatements : true
});
connection.connect(); 

//***********API Functions***********

/*
   This function returns a Promise. This promise is a request to the COVID Tracking API to see if
   it is up and running. It won't be used in the project, but we can use it for testing purposes
   during development.
*/
function covidAPIWorking() {
    return new Promise(function(resolve, reject) {
        let apiStatus = {
            method : "GET",
            url : "https://api.covidtracking.com/v1/status.json"
        }
        
        request(apiStatus, function(error, response, body) {
            if(error) reject(error);
            
            resolve(JSON.parse(body));
        });
    });
}

/*
    This API is used to get the latest COVID info for each state. Used to updated the COVID info in
    our DB.
*/
function getLatestCOVIDStatesInfo() {
    return new Promise(function(resolve, reject){
       let statesReq = {
           method : "GET",
           url : "https://api.covidtracking.com/v1/states/current.json"
       }
       
       request(statesReq, function(error, response, body) {
           if(error) reject(error);
           
           resolve(JSON.parse(body));
       });
    });
}

/*
    This function accepts both a city and a state. It will then query our Air Quality API and get
    the current air quality of that city. If the city is found, the body's status is "success".
    Otherwise, it is "failure".
*/
function getCityAirQuality(city, state) {
    return new Promise(function(resolve, reject){
        var queryURL = "http://api.airvisual.com/v2/city?city=" + city + "&state=" + state +
                  "&country=USA&key=" + process.env.AQAPIKEY;

       let cityAQReq = {
           method : "GET",
           url : queryURL
       }
       
       request(cityAQReq, function(error, response, body) {
           if(error) reject(error);
           
           resolve(JSON.parse(body));
       });
    });
}

function isAuthenticated(req, res, next){
    if(!req.session.authenticated) res.redirect('/login');
    else next();
}


function checkUsername(username){
    let stmt = 'SELECT * FROM users WHERE username=?';
    return new Promise(function(resolve, reject){
       connection.query(stmt, [username], function(error, results){
           if(error) throw error;
           resolve(results);
       }); 
    });
}

function checkPassword(password, hash){
    return new Promise(function(resolve, reject){
       bcrypt.compare(password, hash, function(error, result){
          if(error) throw error;
          resolve(result);
       }); 
    });
}

function containsSpecialCharacters(str){
    var regex = /[ !@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g;
	return regex.test(str);
}

function isLetter(str) {
  return str.length === 1 && str.match(/[a-z]/i);
}

function passwordIsValid(password) {
    var letterCount = 0;
    var numberCount = 0;
    var specialCount = 0;
    var setVals = false;
    
    for(var i = 0; i < password.length; i++) {
        let char = password[i];
        if(isNaN(parseInt(char))) {
            if(containsSpecialCharacters(char)) {
                specialCount += 1;
            } else {
                letterCount += 1;
            }
            
        } else {
            numberCount += 1;
        }
        
        if(numberCount > 0 && letterCount > 0 && specialCount > 0) {
            setVals = true;
        }
    }
    
    return setVals && password.length > 6;
    
}

//*************************************************************** Login and Register Routes

/* Login Routes */
app.get('/login', function(req, res){
    res.render('login');
});

app.post('/login', async function(req, res){
    let isUserExist   = await checkUsername(req.body.username);
    let hashedPasswd  = isUserExist.length > 0 ? isUserExist[0].password : '';
    let passwordMatch = await checkPassword(req.body.password, hashedPasswd);
    if(passwordMatch){
        req.session.authenticated = true;
        req.session.userInfo = isUserExist[0];
        
        if (req.session.userInfo.is_admin) {
            
            // Doesn't exist yet
            res.redirect('/leAdmin');
            
        } else {
            
            res.redirect('/');
        }
        
    }
    else{
        res.render('login', {error: true});
    }
});

/* Register Routes */
app.get('/register', function(req, res){
    let anError = req.query.issue;
    if(anError == undefined)
    {
        anError = "none";
    }
    res.render('register', {issue : anError});
});

app.post('/register', async function(req, res){
    var firstName = req.body.firstname;
    var lastName = req.body.lastname;
    var username = req.body.username;
    var password = req.body.password;
    var passwordConfirm = req.body.passwordConfirm;
    
    var dbQueryResult = await checkUsername(username);
    var areSame = password === passwordConfirm;
    var validPassword = passwordIsValid(password);
    
    let issueRedirect = "/register?issue=";
    
    //If the db has a record with the username, we will redirect to the register and let the user know.
    if(dbQueryResult.length > 0) {
        res.redirect(issueRedirect + "username+is+already+taken");
        return;
    }
    
    //If the passwords do no match, the user will be redirected back to the register page and will see a message
    if(!areSame) {
        res.redirect(issueRedirect + "passwords+do+not+match");
        return;
    }
    
    if(!validPassword) {
        res.redirect(issueRedirect + "password+is+invalid");
        return;
    }
    
    //create user and save in the DB
    let salt = 10;
    bcrypt.hash(password, salt, function(error, hash){
        if(error) throw error;
        let stmt = 'INSERT INTO users (first_name, last_name, username, password, is_admin) VALUES (?, ?, ?, ?, ?)';
        let data = [firstName, lastName, username, hash, false];
        connection.query(stmt, data, function(error, result){
           if(error) throw error;
           res.redirect('/login');
        });
    }); 
});
//***************************************************************************

app.get('/leAdmin', function(req, res) { // the admin, a little french
    
    var stmt = "select * from users;";
    connection.query(stmt, function(error, result){
        if(error) throw error;
        else{
            res.render('leAdmin', {users: result});
        }
    });
});



app.get('/', function(req, res) {
    getLatestCOVIDStatesInfo()
        .then(function(result) {
            res.json(result);
        })
        .catch(function(error) {
            console.log(error);
            res.send(error);
        });
        
    getCityAirQuality("Salinas", "California")
        .then(function(result){
            console.log("result for air quality\n" + result);
        })
        .catch(function(error){
            console.log("error for air quality\n" + error);
        });
});

app.get('/*', function(req, res) {
   res.send("This page doesn't exits!"); 
});

app.listen(process.env.PORT || 3000, function(){
    console.log('Server started');
});