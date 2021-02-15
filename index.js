const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer')
const axios = require('axios')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const flash = require('connect-flash')
const session = require('express-session')
const passport = require('passport')
const localStorage = require('localStorage');
const User = require('./models/user')
const {ensureAuthenticated} = require('./config/auth')
require('dotenv').config();

//Passport Config
require('./config/passport')(passport);

//Express Session 
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
  }));

//Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

//Connect Flash
app.use(flash());

//Global Vars
app.use((req,res,next)=> {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
})

const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({extended: false}))
app.use(express.json())

//DB Config
const db = require('./config/keys').MongoURI;

//Connect DB
mongoose.connect(db, {useNewUrlParser: true,useUnifiedTopology: true})
.then(() => console.log('db connected...'))
.catch(err => console.log(err))

app.get('/', (req,res)=>{
    errors = []
    errors.length = 0
    success = []
    success.length = 0
    res.render('index')
})

var upload = multer()

//Uploading User info
app.post('/upload-info', upload.array('files'), (req, res) => {
    var status;
    errors = []
    var pfp;
    var name = req.body.name
    var bio = req.body.bio
    var backlink = req.body.backlink
    var password = req.body.password

    if(!name || !bio || !backlink || !password){
        errors.push({msg: 'Please fill in all the fields'})
        res.render('index', {errors,name,bio,backlink})
    }else if(backlink.includes('/')){
        errors.push({msg: "Backlink cannot have '/'"})
        res.render('index', {errors,name,bio,backlink})
    }else{
        User.findOne({backlink: backlink})
        .then(user => {
            if(user){
                errors.push({msg: 'Backlink already taken'})
                res.render('index', {errors,name,bio})
            }else{
                var fileinfo = req.files
                if(fileinfo.length == 0){
                    errors.push({msg: 'Please upload a profile picture'})
                    res.render('index', {errors,name,bio,backlink})
                }else{
                    for(let i=0; i < fileinfo.length; i++){
                        const buffer = Buffer.from(fileinfo[i].buffer);
                        const base64String = buffer.toString('base64');
        
                        const config = {
                            method: 'post',
                            url: 'https://api.imgur.com/3/image',
                            headers: { 
                                'Authorization': `Client-ID ${process.env.Client_ID}`, 
                                Accept: 'application/json',
                            },
                            data : {'image':base64String},
                            mimeType: 'multipart/form-data',
                        };
        
                        axios(config)
                        .then(function (response) {
                            pfp = response.data.data.link;
                            console.log(pfp)
                        })
                        .catch(function (error) {
                            status = error.response.status
                            console.log(status);
                        });
                    }
                    errors.length = 0;
                    setTimeout(() => {
                        if(status == 400){
                            res.status(400).send('Some error occurred')
                        }else{
                            localStorage.setItem('name', name);
                            localStorage.setItem('bio', bio);
                            localStorage.setItem('pfp', pfp);
                            localStorage.setItem('backlink', backlink);
                            localStorage.setItem('password', password)
                            res.render('work')
                        }
                    }, fileinfo.length*5000);
                }
        }
    })     
    .catch((err)=> console.log(err))    
    }
})

//Uploading Work
app.post('/profile', upload.array('files'), (req,res)=>{
    var errors = []
    var name = localStorage.getItem('name')
    var bio = localStorage.getItem('bio')
    var pfp = localStorage.getItem('pfp')
    var backlink = localStorage.getItem('backlink')
    var password = localStorage.getItem('password')
    console.log(name,bio,pfp,backlink)
    var image_link = []
    var fileinfo = req.files
    if(fileinfo.length == 0){
        errors.push({msg: 'No files selected'})
        res.render('work', {
            errors
        })
    }
    else if(fileinfo.length > 5){
        errors.push({msg: 'File limit exceeded'})
        res.render('work', {
            errors
        })
    }else{
        for(let i=0; i < fileinfo.length; i++){
            const buffer = Buffer.from(fileinfo[i].buffer);
            const base64String = buffer.toString('base64');
    
            const config = {
                method: 'post',
                url: 'https://api.imgur.com/3/image',
                headers: { 
                    'Authorization': `Client-ID ${process.env.Client_ID}`, 
                    Accept: 'application/json',
                },
                data : {'image':base64String},
                mimeType: 'multipart/form-data',
            };
    
            axios(config)
            .then(function (response) {
                image_link.push(response.data.data.link);
            })
            .catch(function (error) {
                console.log(error.response.status);
            });
        }
        if(fileinfo.length <= 3){
            setTimeout(() => {
                if(image_link.length != fileinfo.length){
                    res.status(400).send('Some error occurred')
                }else{
                    newUser = new User({
                        'name': name,
                        'bio' : bio,
                        'backlink': backlink,
                        'profile_pic': pfp,
                        'work': image_link,
                        'password': password
                    });
    
                    //Hash Password
                    bcrypt.genSalt(10,(err,salt)=>{
                        bcrypt.hash(newUser.password, salt, (err,hash)=>{
                            if(err) throw err;
                            //Set password to hash
                            newUser.password = hash;
                            console.log(newUser.password)
    
                            newUser.save()
                            .then(user => console.log('added to db'))
                            .catch((err)=> console.log(err));
                        })
                    })
                    res.redirect(`/${backlink}`)
                }
            }, fileinfo.length*2000);
        }else{
            setTimeout(() => {
                if(image_link.length != fileinfo.length){
                    res.status(400).send('Some error occurred')
                }else{
                    newUser = new User({
                        'name': name,
                        'bio' : bio,
                        'backlink': backlink,
                        'profile_pic': pfp,
                        'work': image_link,
                        'password': password
                    });
    
                    //Hash Password
                    bcrypt.genSalt(10,(err,salt)=>{
                        bcrypt.hash(newUser.password, salt, (err,hash)=>{
                            if(err) throw err;
                            //Set password to hash
                            newUser.password = hash;
                            console.log(newUser.password)
    
                            newUser.save()
                            .then(user => console.log('added to db'))
                            .catch((err)=> console.log(err));
                        })
                    })
                    res.redirect(`/${backlink}`)
                }
            }, fileinfo.length*1500);
        }
        
    }
    
})

//Login Handle
app.post('/login', (req,res,next)=> {
    errors = []
    var backlink = req.body.backlink
    var password = req.body.password

    if(!backlink || !password){
        errors.push({msg: 'Please fill in all the fields'})
        res.render('login', {errors,backlink})
    }else{
        passport.authenticate('local', {
            successRedirect: '/edit',
            failureRedirect: '/login',
            failureFlash: true
        })(req,res,next)
    }
})

//Edit Info
app.post('/edit-info', upload.array('files'), (req,res)=>{
    var status;
    errors = []
    success = []
    var pfp;
    var name = req.body.name
    var bio = req.body.bio
    var backlink = req.body.backlink
    var password = req.body.password

    if(backlink.includes('/')){
        errors.push({msg: "Backlink cannot have '/'"})
        res.render('edit', {errors,name,bio,backlink})
    }else{
        User.findOne({backlink: backlink})
        .then(user => {
            if(user.name != name && user.bio != bio){
                errors.push({msg: 'Backlink already taken'})
                res.render('edit', {errors,name,bio})
            }else{
                var fileinfo = req.files
                if(fileinfo.length > 0){
                    for(let i=0; i < fileinfo.length; i++){
                        const buffer = Buffer.from(fileinfo[i].buffer);
                        const base64String = buffer.toString('base64');
        
                        const config = {
                            method: 'post',
                            url: 'https://api.imgur.com/3/image',
                            headers: { 
                                'Authorization': `Client-ID ${process.env.Client_ID}`, 
                                Accept: 'application/json',
                            },
                            data : {'image':base64String},
                            mimeType: 'multipart/form-data',
                        };
        
                        axios(config)
                        .then(function (response) {
                            pfp = response.data.data.link;
                            console.log(pfp)
                        })
                        .catch(function (error) {
                            status = error.response.status
                            console.log(status);
                        });
                    }
                    errors.length = 0;
                    setTimeout(() => {
                        if(status == 400){
                            res.status(400).send('Some error occurred')
                        }else{
                            if(password){
                                //Hash Password
                                bcrypt.genSalt(10,(err,salt)=>{
                                    bcrypt.hash(password, salt, (err,hash)=>{
                                        if(err) throw err;
                                        //Set password to hash
                                            password = hash;
                                        
                                        try {
                                           //Update User
                                        User.updateOne({backlink},{
                                            $set : {
                                                name: name,
                                                bio: bio,
                                                backlink: backlink,
                                                profile_pic: pfp,
                                                password: password
                                            }
                                        })
                                        .then(() => {
                                            req.flash('success_msg', 'Profile updated successfully')
                                            res.redirect('/edit')
                                        })
                                        .catch((err)=> console.log(err))
                                        } catch (error) {
                                            console.log(error)
                                        }
                                })
                            })
                         }else{
                            try {
                                //Update User
                             User.updateOne({backlink},{
                                 $set : {
                                     name: name,
                                     bio: bio,
                                     backlink: backlink,
                                     profile_pic: pfp,
                                 }
                             })
                             .then(() => {
                                 req.flash('success_msg', 'Profile updated successfully')
                                 res.redirect('/edit')
                             })
                             .catch((err)=> console.log(err))
                             } catch (error) {
                                 console.log(error)
                             }
                         }
                    }
                }, fileinfo.length*7000);
        }else{
            if(password){
                //Hash Password
                bcrypt.genSalt(10,(err,salt)=>{
                    bcrypt.hash(password, salt, (err,hash)=>{
                        if(err) throw err;
                        //Set password to hash
                            password = hash;
                        
                        try {
                           //Update User
                        User.updateOne({backlink},{
                            $set : {
                                name: name,
                                bio: bio,
                                backlink: backlink,
                                password: password
                            }
                        })
                        .then(() => {
                            req.flash('success_msg', 'Profile updated successfully')
                            res.redirect('/edit')
                        })
                        .catch((err)=> console.log(err))
                        } catch (error) {
                            console.log(error)
                        }
                })
            })
         }else{
            try {
                //Update User
             User.updateOne({backlink},{
                 $set : {
                     name: name,
                     bio: bio,
                     backlink: backlink,
                 }
             })
             .then(() => {
                 req.flash('success_msg', 'Profile updated successfully')
                 res.redirect('/edit')
             })
             .catch((err)=> console.log(err))
             } catch (error) {
                 console.log(error)
             }
         }         
        }
    }
    })     
    .catch((err)=> console.log(err))    
    }
})

app.post('/update-images', upload.array('files'), (req,res)=>{
    var backlink = localStorage.getItem('backlink')
    var errors = []
    var image_link = []
    var fileinfo = req.files
    if(fileinfo.length == 0){
        errors.push({msg: 'No files selected'})
        res.render('edit-images', {
            errors
        })
    }
    else if(fileinfo.length > 5){
        errors.push({msg: 'File limit exceeded'})
        res.render('edit-images', {
            errors
        })
    }else{
        for(let i=0; i < fileinfo.length; i++){
            const buffer = Buffer.from(fileinfo[i].buffer);
            const base64String = buffer.toString('base64');
    
            const config = {
                method: 'post',
                url: 'https://api.imgur.com/3/image',
                headers: { 
                    'Authorization': `Client-ID ${process.env.Client_ID}`, 
                    Accept: 'application/json',
                },
                data : {'image':base64String},
                mimeType: 'multipart/form-data',
            };
    
            axios(config)
            .then(function (response) {
                image_link.push(response.data.data.link);
            })
            .catch(function (error) {
                console.log(error.response.status);
            });
        }
        if(fileinfo.length <= 3){
            setTimeout(() => {
                if(image_link.length != fileinfo.length){
                    res.status(400).send('Some error occurred')
                }else{
                    User.updateOne({backlink},{
                        $set : {
                            work: image_link
                        } 
                    })
                    .then(() =>{
                        req.flash('success_msg', 'Images updated successfully')
                        res.redirect('/edit-images')
                    })
                    .catch((err)=> console.log(err))
                    }
            }, fileinfo.length*2000);
        }else{
            setTimeout(() => {
                if(image_link.length != fileinfo.length){
                    res.status(400).send('Some error occurred')
                }else{   
                    User.updateOne({backlink},{
                        $set : {
                            work: image_link
                        } 
                    })
                    .then(() =>{
                        req.flash('success_msg', 'Images updated successfully')
                        res.redirect('/edit-images')
                    })
                    .catch((err)=> console.log(err))
                    }
            }, fileinfo.length*1500);
        }   
    }   
})

//Login Page
app.get('/login', (req,res)=>{
    errors = []
    errors.length = 0
    res.render('login')
})

//Logout Handle
app.get('/logout', (req,res)=>{
    req.logout();
    req.flash('success_msg', 'You have been logged out.')
    res.redirect('/login')
})

//Edit Page 
app.get('/edit', ensureAuthenticated, (req,res)=>{
    var name = localStorage.getItem('name')
    var bio = localStorage.getItem('bio')
    var backlink = localStorage.getItem('backlink')
    res.render('edit', {name,bio,backlink})
})

//Edit Images
app.get('/edit-images', ensureAuthenticated, (req,res)=>{
    res.render('edit-images')
})

//Profile Page
app.get('/:backlink', async(req,res)=>{
    const user = await User.findOne({backlink: req.params.backlink})
    if(user == null) return res.sendStatus(404)

    res.render('profile', {
        'name': user.name,
        'bio': user.bio,
        'pfp': user.profile_pic,
        'images': user.work
    })
})


app.listen(PORT, console.log(`Server started on port ${PORT}`))