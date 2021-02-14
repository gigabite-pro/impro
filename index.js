const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer')
const axios = require('axios')
const mongoose = require('mongoose')
const localStorage = require('localStorage');
const User = require('./models/user')
require('dotenv').config();


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
    res.render('index')
})

var upload = multer()

app.post('/upload-info', upload.array('files'), (req, res) => {
    var status;
    errors = []
    let pfp = ''
    var name = req.body.name
    var bio = req.body.bio
    var backlink = req.body.backlink

    User.findOne({backlink: backlink})
        .then(user => {
            if(user){
                errors.push({msg: 'Backlink already taken'})
                res.render('index', {errors,name,bio})
            }else{
                var fileinfo = req.files
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
            errors.length = 0
            setTimeout(() => {
                if(status == 400){
                    res.status(400).send('Some error occurred')
                }else{
                    localStorage.setItem('name', name);
                    localStorage.setItem('bio', bio);
                    localStorage.setItem('pfp', pfp);
                    localStorage.setItem('backlink', backlink);
                    res.render('work')
                }
            }, fileinfo.length*5000);
        }
    })     
    .catch((err)=> console.log(err)) 
})

app.post('/profile', upload.array('files'), (req,res)=>{
    var errors = []
    var name = localStorage.getItem('name')
    var bio = localStorage.getItem('bio')
    var pfp = localStorage.getItem('pfp')
    var backlink = localStorage.getItem('backlink')
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
        setTimeout(() => {
            if(image_link.length != fileinfo.length){
                res.status(400).send('Some error occurred')
            }else{
                newUser = new User({
                    'name': name,
                    'bio' : bio,
                    'backlink': backlink,
                    'profile_pic': pfp,
                    'work': image_link
                });
    
                newUser.save();
                res.redirect(`/${backlink}`)
            }
        }, fileinfo.length*1500);
    }
    
})

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