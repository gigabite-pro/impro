const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs')
const localStorage = require('localStorage')

//Load User Model
const User = require('../models/user')

module.exports = function (passport){
    passport.use(
        new LocalStrategy({ usernameField: 'backlink'}, (backlink,password,done) =>{
            //Match User
            User.findOne({backlink : backlink})
            .then(user => {
                if(!user){
                    return done(null, false, {message: 'Backlink not found'});
                }

                //Match Password
                bcrypt.compare(password, user.password, (err, isMatch)=>{
                    if(err) throw err;

                    if(isMatch){
                        localStorage.setItem('name', user.name)
                        localStorage.setItem('bio', user.bio)
                        localStorage.setItem('backlink', user.backlink)
                        return done(null, user);
                    }else{
                        return done(null, false, {message: 'Incorrect Password'})
                    }
                });
            })
            .catch((err)=> console.log(err))
        })
    );
    passport.serializeUser(function(user, done) {
        done(null, user.id);
      });
      
      passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
          done(err, user);
        });
      });
}