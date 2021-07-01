// jshint esversion:6

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const flash = require('express-flash');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3000;
const Mongo_URL = process.env.Mongo_URL;

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// initialize flash
app.use(flash());

// Session
app.use(session({
    secret: process.env.COOKIE_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({mongoUrl: Mongo_URL}),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 Hours
}));

// multer -> use to store image in uploads folder
const Storage = multer.diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb)=>{
        cb(null,file.fieldname+"_"+Date.now()+path.extname(file.originalname));
    }
});

const upload = multer({
    storage: Storage
});

//Database Connection
mongoose.connect(Mongo_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true
});

// creating table
// collection 1 for user authentication
const userSchema = new mongoose.Schema({
    username: {type: String, unique: true},
    password: String,
    name: String,
    role: {type: String, default: "admin"}
});

const User = new mongoose.model("User", userSchema);

// collection 2 for movie list
const movieSchema = new mongoose.Schema({
    name: {type: String, unique: true, require: true}, //name of the movie
    link: { type: String, required: true }, // mediafire movie link
    image: { type: String, required: true }, // image url
    year: { type: Number, required: true }, // 2019
    language: String,
    category: { type: String, required: true }, // comeady, kids, romantic, adult
    type: { type: String, required: true }, // bollywood, hollywood, south, web-series
    description: String
});

const Movie = new mongoose.model("Movie", movieSchema);

// Passport config
function init(passport){
    passport.use(new LocalStrategy({ usernameField: "username", passwordField: "password"}, async (username, password, done)=>{
        // Login Logic
        // Check if username exists
        const user = await User.findOne({username: username});
        if(!user){
            return done(null, false, {message: "No user with this Email ID is found!"});
        }
        bcrypt.compare(password, user.password).then((match)=>{
            if(match){
            return done(null, user, {message: "Logged in successfully!"});
        }
        return done(null, false, {message: "Invali Credentials!"});
    }).catch((err)=>{
            return done(null, false, {message: "Something went wrong!"});
        });
    }));

    //serialize and deserialize
    passport.serializeUser((user, done)=>{
        done(null, user._id);
    });

    passport.deserializeUser((id, done) =>{
        User.findById(id, (err, user)=>{
            done(err, user);
        });
    });
}
// Calling passport function
init(passport);
app.use(passport.initialize());
app.use(passport.session());

// it provides req.user object in frontend as well as in backend
app.use((req, res, next)=>{
    res.locals.session = req.session;
    res.locals.user = req.user;
    next();
});

// All Routes
app.get('/', (req, res)=>{
    Movie.find({}, null, { sort: {year: -1 }}, (err, foundData)=>{
        res.render('index', {current: 'home', data: foundData});
    });
});

app.post('/search', (req, res)=>{
    // const name = req.body.search;
    // const organize_name = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase()))); //convert first letter to upper case of every word
    const regex = new RegExp(req.body.search, 'i');

    Movie.findOne({name: regex}, (err, foundData)=>{
        if(err){
            console.log(err);
        }
        if(foundData){
            res.render("search", {current: 'search', data: foundData});
        }else{
            req.flash("error", "No result found!");
            return res.redirect('/');
        }
    });
});

app.get('/bollywood', (req, res)=>{
    Movie.find({}, null, { sort: {year: -1 }}, (err, foundData)=>{
        res.render("bollywood", {current: 'bollywood', data: foundData});
    });
});

app.get('/hollywood', (req, res)=>{
    Movie.find({}, null, { sort: {year: -1 }}, (err, foundData)=>{
        res.render("hollywood", {current: 'hollywood', data: foundData});
    });
});

app.get('/south', (req, res)=>{
    Movie.find({}, null, { sort: {year: -1 }}, (err, foundData)=>{
        res.render("south", {current: 'south', data: foundData});
    });
});

app.get('/web-series', (req, res)=>{
    Movie.find({}, null, { sort: {year: -1 }}, (err, foundData)=>{
        res.render("web-series", {current: 'web-series', data: foundData});
    });
});

//admin-panel routes
app.get('/admin-login', (req, res)=>{
    if(!req.isAuthenticated()){
        return res.render('admin-login');
    }
    res.redirect('/admin/dashboard');
});

app.post('/admin-login', (req, res, next)=>{
    // const username = req.body.username;
    // const password = req.body.password;

    // login logic
    passport.authenticate("local", (err, user, info)=>{
        if(err){
            req.flash("error", info.message);
            return next(err);
        }

        if(!user){
            req.flash("error", info.message);
            return res.redirect('/admin-login');
        }

        req.logIn(user, (err)=>{
            if(err){
                req.flash("error", info.flash);
                return next(err);
            }
            return res.redirect("/admin/dashboard");
        })
    })(req, res, next);
});

app.get('/auth/admin-register', (req, res)=>{
    res.render('admin-register');
});

app.post('/auth/admin-register', (req, res)=>{
    // add user info in database
    const username = req.body.username;
    const name = req.body.name;
    const password = req.body.password;
    const cpassword = req.body.cpassword;
    const organize_name = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase()))); //convert first letter to upper case of every word

    if(!username.trim() || !name.trim() || !password.trim() || !cpassword.trim()){
        req.flash("error", "All fields are mendatory!");
        return res.redirect('/auth/admin-register');
    }else{
        if(cpassword === password){
            User.exists({username: username}, async(err, foundUser)=>{
                if(foundUser){
                    req.flash("error", "Email ID is already registered!");
                    return res.redirect('/auth/admin-register');
                    
                }else{
                    const hash_password = await bcrypt.hash(password, 10);
                    // database logic to add data in collections
                    const user = new User({
                        username: username,
                        name: organize_name,
                        password: hash_password,
                        role: "admin"
                    });
                    // save collection
                    user.save((err)=>{
                        if(err){
                            console.log(err);
                        }
                        if(req.isAuthenticated()){
                            req.flash("success", "Valid credentials are send to user Email ID!");
                            res.redirect('/admin/users');
                        }else{
                            req.flash("success", "User registered successfully!");
                            res.redirect('/admin-login');
                        }
                        
                        // Node Mailer initialize
                        // Step-1 use transporter
                        const transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                                user: process.env.EMAIL_ID,
                                pass: process.env.EMAIL_PASSWORD
                            }
                        });

                        // Step 2
                        ejs.renderFile(path.join(__dirname, "/views/mail.ejs"), { name: name, username: username,  password: password }, function (err, data) {
                            if (err) {
                                console.log(err);
                                req.flash("error", "Something went wrong!");
                                return res.redirect("/auth/admin-register");
                            } else {
                                const options = {
                                    from: process.env.EMAIL_ID,
                                    to: username,
                                    subject: "Movies Prime - Admin Registration Successfully",
                                    html: data
                                }
                        
                                transporter.sendMail(options, (err, info) => {
                                    if (err) {
                                        console.log(err);
                                        req.flash("error", "Something went wrong!");
                                        return res.redirect("/auth/admin-register");
                                    }
                                    return console.log('email successfully sent to ' + username);
                                    
                                });
                            }
                        });
                        // Node Mailer End
                    });
                }
            });
        }else{
            req.flash("error", "Password doesn't match!");
            return res.redirect('/auth/admin-register');
        }
    }
});

app.get('/admin/dashboard', (req, res)=>{
    if(req.isAuthenticated()){
        res.render('admin-dashboard', {current: 'dashboard'});
    }else{
        res.redirect('/admin-login');
    }
});

app.get('/admin/movies-mgt', (req, res)=>{
    if(req.isAuthenticated()){
        Movie.find({}, (err, foundData)=>{
            res.render('admin-movies', {current: 'movies', data: foundData});
        });
    }else{
        res.redirect('/admin-login');
    }

});

app.post('/admin/movies-mgt', upload.single('file'), (req, res, next)=>{
    const name = req.body.name;
    const link = req.body.link;
    const image = req.file.filename;
    const language = req.body.lang;
    const year = req.body.year;
    const category = req.body.category;
    const type = req.body.type;
    const description = req.body.desc;
    const compressed_type = type.toLowerCase();
    const organize_name = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase()))); //convert first letter to upper case of every word

    // check that the input field are not empty 
    if (!name.trim() || !link.trim() || !language.trim() || !year.trim() || !category.trim() || !type.trim() || !description.trim()){
        req.flash("error", "All fields are mandatory!");
        return res.redirect('/admin/movies-mgt');
    } else{
        // database logic to add data in collections
        const movie = new Movie({
            name: organize_name,
            link: link,
            image: image,
            language: language,
            year: year,
            category: category,
            type: compressed_type,
            description: description
        });
        // save collection
        movie.save((err)=>{
            if(err){
                console.log(err);
            }
            req.flash("success", "Movie added successfully!");
            res.redirect('/admin/movies-mgt');
        });
    }    
});

app.post('/admin/movies-mgt/edit', (req, res) => {
    const name = req.body.name;
    const link = req.body.link;
    const language = req.body.lang;
    const year = req.body.year;
    const category = req.body.category;
    const type = req.body.type;
    const description = req.body.desc;
    const compressed_type = type.toLowerCase();
    const organize_name = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase()))); //convert first letter to upper case of every word

    if (!name.trim() || !link.trim() || !language.trim() || !year.trim() || !category.trim() || !type.trim() || !description.trim()){
        req.flash("error", "All fields are mandatory!");
        return res.redirect('/admin/movies-mgt');
    } else{
            Movie.findByIdAndUpdate(req.body.movieId, {
                name: organize_name,
                link: link,
                language: language,
                year: year,
                category: category,
                type: compressed_type,
                description: description
            }, (err, product) => {
                req.flash("success", "Movie update sucessfully!");
                res.redirect("/admin/movies-mgt");
            });
    }
});

app.post('/admin/movies-mgt/delete', (req, res) => {
    Movie.findByIdAndDelete(req.body.movieId, (err, movie) => {
        if (err) {
            console.log(err);
        } else {
            fs.unlink('./public/uploads/'+ movie.image, (err)=>{
                req.flash("success", "Movie deleted successfully!");
                res.redirect("/admin/movies-mgt");
            });
        }
    });
});

app.get('/admin/users', (req, res)=>{
    if(req.isAuthenticated()){
        User.find({}, (err, foundData)=>{
            res.render("admin-users", {current: 'users', data: foundData});
        });
    }else{
        res.redirect('/admin-login');
    }
});

app.get('/admin/profile', (req, res)=>{
    if(req.isAuthenticated()){
            res.render("admin-profile", {current: 'profile'});
    }else{
        res.redirect('/admin-login');
    }
});

app.post('/admin/profile/change_password', async(req, res)=>{
    const newPassword = req.body.password;
    const confirmNewPassword = req.body.cpassword;
    if(newPassword === confirmNewPassword){
        if(!newPassword.trim() || !confirmNewPassword.trim()){
            req.flash("error", "Password can't be empty!");
            res.redirect('/admin/profile');
        }else{
            const hashPassword = await bcrypt.hash(newPassword, 10);
            User.findByIdAndUpdate(req.user._id, {
                password: hashPassword
            }, (err, foundData)=>{
                if(err){
                    console.log(err);
                }else{
                    if(foundData){
                        req.flash("success", "Password changed successfully");
                        res.redirect('/admin/profile');
                    }
                }
            });
        }
    }else{
        req.flash("error", "Password doesn't match!");
        res.redirect('/admin/profile');
    }
});

app.post('/admin/profile/change_name', (req, res)=>{
    const name = req.body.name;
    const organize_name = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase()))); //convert first letter to upper case of every word
    if(!name.trim()){
        req.flash('error','Name field can not be empty!');
        res.redirect('/admin/profile');
    } else {
        User.findByIdAndUpdate((req.body.userId),{
            name: organize_name
        },(err, foundData)=>{
            if(err){
                console.log(err);
            }else{
                if(foundData){
                    req.flash("success", "Name changed successfully!");
                    res. redirect('/admin/profile');
                }
            }
        }); 
    }
});

app.post('/admin/profile/delete_account', (req, res)=>{
    User.findByIdAndDelete(req.body.userId, (err, foundData)=>{
        if(err){
            console.log(err);
            req.flash("error", "Something went wrong!");
            res.redirect('/admin/profile');
        }else{
            if(foundData){
                req.flash("success", "Profile deleted successfully!");
                res.redirect('/admin/sign-out');
            }
        }
    });
});

app.get('/admin/sign-out', (req, res)=>{
    req.logOut();
    res.redirect('/admin-login');
});

// Server PORT
app.listen(PORT, ()=>{
    console.log(`Server starts at PORT: ${PORT}`);
});