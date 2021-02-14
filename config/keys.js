const { MongoURI } = require("../../auth trial/config/keys")

module.exports = {
    MongoURI: `mongodb+srv://Chin2:${process.env.DB_PASSWORD}@parophila.rmkyt.mongodb.net/userdata?retryWrites=true&w=majority`
}