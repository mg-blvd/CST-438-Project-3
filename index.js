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

//Delete that

const connection = mysql.createConnection({
    host: process.env.HOST, //local
    user: process.env.USERNAME,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    multipleStatements : true
});
connection.connect(); 



function isAuthenticated(req, res, next){
    if(!req.session.authenticated) res.redirect('/login');
    else next();
}


function checkUsername(username){
    let stmt = 'SELECT * FROM user WHERE username=?';
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

app.get('/', function(req, res) {
   res.send("At least it works!"); 
});

app.get('/*', function(req, res) {
   res.send("This page doesn't exits!"); 
});

app.listen(process.env.PORT || 3000, function(){
    console.log('Server started');
});