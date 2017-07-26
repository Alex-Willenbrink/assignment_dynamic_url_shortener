const lib = require('./lib');
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const redisClient = require("redis").createClient();
const hbs = require("express-handlebars");
const bodyParser = require("body-parser");
const validUrl = require("valid-url");

app.engine("handlebars", hbs({defaultLayout: "main"}));
app.set("view engine", "handlebars");
app.use(express.static(`${__dirname}/public`));
app.use("/socket.io", express.static(__dirname + "node_modules/socket.io-client/dist/"));
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', (req, res) => {
  res.render("index");
})

function update(client) {
  console.log("updating");
  lib.redisTools.getAllKeys().then(keys => {
    keys.forEach(key => {
      lib.redisTools.getData(key).then(data => {
        client.emit("newId", data);
      })
    })
  })
}

let baseUrl = process.env.BASE_URL || "http://localhost:3000";

io.on('connection', client => {
  update(client);

  client.on("url", (url) => {

    let id = lib.shortener.linkShortener();
    let {name} = url;

    let objStorage = {
      id: id,
      urlLong: name,
      urlShort: `${baseUrl}/${id}`,
      count: 0
    }
    
    if (validUrl.isUri(name)) {
      lib.redisTools.storeData(id, objStorage).then(() => lib.redisTools.getData(id)).then((data) => {
        client.emit("newId", data);
      })

    } else {
      client.emit("inputError");
    }
  })

  app.all('/:id', (req, res) => {
    const id = req.params.id.trim();
    lib.redisTools.getData(id)
    .then((data) => {
      data["count"] = (parseInt(data["count"]) + 1).toString();
      lib.redisTools.storeData(data["id"], data)
    .then(() => lib.redisTools.getData(id))
    .then((data) => {
      console.log(data);
      client.emit("count", data);
      res.redirect(data["urlLong"])
      })
    }).catch((err) => console.log(err))
  })
})

server.listen(3000);
