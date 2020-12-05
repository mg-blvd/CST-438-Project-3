var express = require('express');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var request = require('request');
var app = express();
const cron = require('node-cron');

var session = require('express-session');
var bcrypt = require('bcrypt');
var state = 0;

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

/*
    This function is a helper function that connects a few other functions together. First, we get
    the latest covid info from our COVID API. Then, we send that data into another function that 
    will update our DB with the latest information. If there is an error, we print the error. 
*/
function updateStatesTable() {
    getLatestCOVIDStatesInfo()
        .then(sendStatesDataToDB)
        .catch(function(error){
            console.log(error);
        });
}

/*
    This function accepts the new COVID information and updates our DB with it. It will create a 
    that will have multiple update statemts with all the new information we gathered from the API. 
*/
function sendStatesDataToDB(result) {
    let stmt = "UPDATE states SET covid_death = ?, covid_count = ?, trajectory_hospitalize = ? " +
               "WHERE state_ab = ?;";
    var query = "";
    var data = [];
   
    result.forEach(function(singleState) {
            query += stmt;
            data.push(singleState.deathIncrease);
            data.push(singleState.positiveIncrease);
            data.push(singleState.hospitalizedIncrease);
            data.push(singleState.state);
        });
        
        connection.query(query, data, function(error, results) {
            if(error) throw error;
            
            console.log("Update successful!");
        });
}

function printStatesTable() {
    let query = "SELECT covid_death, covid_count, trajectory_hospitalize, state_ab FROM states;";
    
    connection.query(query, [], function(error, results) {
        if(error) throw error;

        console.log(results);
    })
}

function querySingleState(state) {
    let stmt = "SELECT * FROM states WHERE state_name = ?;";
    return new Promise(function(resolve, reject){
       connection.query(stmt, [state], function(error, results){
          if(error) throw error;
          resolve(results);
       });
    });
}

function getCityInfo(city, state) {
    var promises = [querySingleState(state), getCityAirQuality(city, state)];
    return Promise.all(promises);//copyright trademark chuy no one has this i made this, some guy named misa says he made this but i think hes crazy
} 

function getUserPins(userInfo) {
    let stmt = "SELECT * FROM pins WHERE user = ?";
    return new Promise(function(resolve, reject) {
        connection.query(stmt, userInfo.user_id, function(error, results) {
            if(error) reject(error);
            resolve(results);
        })
    });
}

function getUserPinsWithAQ(userInfo) {
    return new Promise((resolve, reject) => {
        getUserPins(userInfo)
        .then((pins) => {
            var cityPromises = [];
            pins.forEach((pin) => {
                cityPromises.push(getCityInfo(pin.city, pin.state_name));
            });
            
            Promise.all(cityPromises).then((results) => {
                for(var i = 0; i < results.length; i++) {
                    results[i].push(pins[i].pin_id);
                }
                
                resolve(results);
            });
        });
    });
}

function isAuthenticated(req, res, next){
    if(!req.session.authenticated) res.redirect('/login');
    else next();
}

/*
    The following functions check the validity of the inputted user information 
*/

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

//*************************************************************** Testing the time thing
updateStatesTable();
cron.schedule('0 0 0 * * *', function(){
    // the way it works is sec min hour day month dayweek
    // the * is for any, if its a digit then its for when it matches
    console.log("Triggered for the day, " + new Date);
    updateStatesTable();
});

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
            state = 1;
            res.redirect('/leAdmin');
            
        } else {
            state = 2;
            res.redirect('/leUser');
        }
        
    }
    else{
        res.render('login', {error: true});
    }
});

/* Logout Route */
app.get('/logout', function(req, res){
   req.session.destroy();
   state = 0;
   res.redirect('/');
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
    
    try{
        if(req.session.userInfo.is_admin){
            var stmt1 = "select * from users inner join pins on users.user_id = pins.user;";
            connection.query(stmt1, function(error1, result1){
                if(error1) throw error1;
                else{
                    var stmt2 = "select * from states;";
                    connection.query(stmt2, function(error2, result2) {
                        if (error2) throw error2;
                        res.render('leAdmin', {users: result1, states: result2, isAuth: req.session.userInfo.is_admin})
                    })
                }
            });
        }
        else{
            res.redirect('/');
        }
    } catch(err){
        res.redirect('/');
    }
    
});

app.get('/leDelete/:pinId', isAuthenticated, function(req, res) { // generic delete end point
    var stmt = "DELETE FROM pins WHERE pin_id=?";
    var data = [req.params.pinId];
    console.log("the pinId", req.params.pinId);
    
    connection.query(stmt, data, function(error, result) {
        if (error) res.json({error: false});
        else{
            console.log("success at deleting", result);
            res.json({result: true});
        }
    });
    
});

app.get('/leUpdateDesc/:pindId/:desc', isAuthenticated, function(req, res) {
    var stmt = "UPDATE pins SET description=? WHERE pin_id=?";
    var data = [req.params.desc, req.params.pindId];
    
    connection.query(stmt, data, function(error, results) {
        if (error) res.json({error: false});
        else{
            console.log("success at updating description", results);
            res.json({results: true});
        }
    });
});

app.post('/deleteUsr', function(req, res) { // generic user delete
    var stmt1 = "DELETE FROM pins WHERE user=?;";
    var stmt2 = "DELETE FROM users WHERE user_id=?";
    
    // if(req.session.userInfo.user_id == req.body.usrId){ // can't self delete so...
    //     res.redirect(req.body.returnUrl);
    //     console.log("same id F");
    //     return;
    // }
    
    
    
    var data1 = [req.body.usrId];
    connection.query(stmt1, data1, function(error1, results1) {
        if (error1) throw error1;
        
        connection.query(stmt2,data1,function(error2, results2) {
            if (error2) throw error2;
            else{
                res.redirect(req.body.returnUrl); /// could be a json response, if so then do jquery
            }
        });
    });
});

app.post('/leStateUpdate', isAuthenticated, function(req, res) { /// returns json, uses form tho
    var stmt = "UPDATE states SET covid_count=?, covid_death=?, trajectory_death=?, trajectory_hospitalize=?, trajectory_test=? WHERE state_ab=?;";
    var data = [parseInt(req.body.count), parseInt(req.body.death), parseInt(req.body.tra_death), parseInt(req.body.tra_hos), parseInt(req.body.tra_test), req.body.ab];
    
    connection.query(stmt, data, function(error, results) {
        if (error) throw error;
        res.redirect("/leAdmin");
    });
    
});

app.get('/leUser', isAuthenticated, function(req, res) { // the admin, a little french
    
    
    var stmt = "select * from (select pins.pin_id, pins.user, pins.state_name," +
    " pins.city, pins.description, states.covid_count, states.covid_death, states.trajectory_death, states.trajectory_hospitalize, states.trajectory_test" +
    " from pins inner join states on pins.state_name=states.state_name) as joinedd where joinedd.user=?";
    var data = [req.session.userInfo.user_id];
    
    connection.query(stmt, data, function(error, results) {
        if (error) throw error;
        else{
            console.log(results);
            res.render('leUser', {pinData: results, user: req.session.userInfo});
        }
    });
    
    
    // req.session.userInfo.is_admin
    // try{
    //     if(!req.session.userInfo.is_admin){
    //         var stmt1 = "select * from users inner join pins on users.user_id = pins.user;";
    //         connection.query(stmt1, function(error1, result1){
    //             if(error1) throw error1;
    //             else{
    //                 var id = req.session.userInfo.user_id;
    //                 var stmt2 = "select user_id, first_name, last_name, username from users where users.user_id = " + id;
    //                 connection.query(stmt2, function(error2, data) {
    //                     if (error2) throw error2;
    //                     getUserPinsWithAQ(req.session.userInfo)
    //                     .then((result) => res.render('leUser', {data: data, isAuth: 2, pinData : result}));
    //                 })
    //             }
    //         });
    //     }
    //     else{
    //         res.redirect('/');
    //     }
    // } catch(err){
    //     res.redirect('/');
    // }
    
});
//***************************************************************************


app.post('/create_pin', function(req, res) {
    
    var is_admin_var;
    
    if (req.session.userInfo.is_admin == 0) {
        is_admin_var = false;
    } else {
        is_admin_var = true;
    }
    
    let stmt = "insert into pins (user, state_name, city, description, is_public) values (?,?,?,?,?)";
    let data = [parseInt(req.body.userId), req.body.stateName, req.body.city, req.body.desc, is_admin_var];
    

    console.log(data);
    
    connection.query(stmt, data, function(error, results) {
        if(error){
            console.log("error pin making"); 
            res.redirect('/'); // or wherever the pins are being made
        }
        else{
            console.log("successful pin making");
            res.redirect('/'); // or wherever we want
        }
    });
});

app.post('/search', function(req, res) {
    
    var stmt = 'select * from states where state_name = ?;';
    
    var state = req.body.states;
    var city = req.body.inputSearch;
    
    var airQualityJson;

    
    getCityInfo(city, state) 
    .then((airQualityJson) => res.render('search', {user : req.session.userInfo,
                                                    covidInfo : airQualityJson[0][0], 
                                                    airQualitySuccess: airQualityJson[1]["status"], 
                                                    airQualityInfo : airQualityJson[1]["data"], 
                                                    loggedIn : req.session.authenticated}) );
    
    // .then((airQualityJson) => console.log("Data: ", airQualityJson) ); (Used only to look at data)

/*
   Example for reference using California, Salinas  
{
    state_ab: 'CA',
    covid_count: 9811,
    covid_death: 61,
    trajectory_death: 0,
    trajectory_hospitalize: 0,
    trajectory_test: 0,
    state_name: 'California'
}
    
{
status: 'success',
data: {
        city: 'Salinas',
        state: 'California',
        country: 'USA',
        location: [Object], // look below for these
        current: [Object]
    }
}
  
location: { type: 'Point', coordinates: [ -121.6222, 36.694698 ] },
current: {
    weather: {
        ts: '2020-11-19T02:00:00.000Z',
        tp: 14,
        pr: 1020,
        hu: 82,
        ws: 2.6,
        wd: 330,
        ic: '04n'
    },
    pollution: {
        ts: '2020-11-19T00:00:00.000Z',
        aqius: 9,
        mainus: 'p2',
        aqicn: 3,
        maincn: 'p2'
    }
}
*/

});

app.get('/', function(req, res) {
    console.log("The Current time is " + new Date); // see server time
    console.log(state);
    console.log("=========================");
    res.render('home', {isAuth : req.session.authenticated, state : state});
});

app.get('/*', function(req, res) {
   res.send("This page doesn't exits!"); 
});

app.listen(process.env.PORT || 3000, function(){
    console.log('Server started');
});