var   express     =require("express"),
      mysql       =require("mysql"),
      app         =express(),
      methodOverride=require("method-override"),
      session     =require("express-session"),
      flash       =require("connect-flash"),
      bodyparser  =require("body-parser");
const bcrypt      =require("bcrypt");

var connection = mysql.createConnection({
    host:'localhost',
    user:'ronakbandwal',
    database:'c9'
});
var message="";
app.use(bodyparser.urlencoded({extended:true}));
app.set("view engine","ejs");
app.use(methodOverride("_method"));
app.use(express.static(__dirname+"/public"));
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60000 }
}));
app.use(flash());

app.get("/",function(req, res) {
    res.redirect("login");
});
app.get("/login",function(req, res) {
    req.session.user=null;
    var user=req.session.user;
    res.render("login",{user:user,message:message});
    message="";
});
app.get('/profile',function(req, res) {
   var user=req.session.user;
    var q="select songs.* from songs inner join library on library.songID=songs.songID where library.userID="+user.userID+";";
    connection.query(q,function(error, results, fields) {
       if(error) throw error;
       res.render('profile',{results:results,user:user});
    });
   
});
app.post("/login",function(req, res) {
    console.log(req.body);
    var username=req.body.username;
    var password=req.body.password;
    var q="SELECT * FROM users WHERE username='"+username+"'";
    connection.query(q,function(error, results, fields) {
        if(error) throw error;
        if(results[0]==null) {res.redirect('login');}
        else if(bcrypt.compareSync(password,results[0].password)) {
            req.session.user = results[0];
            res.redirect("home");
        } else {
            message="username or password incorrect";
            res.redirect('login');
        }
    });
    
});
app.get("/home",function(req,res) {
    var user=req.session.user;
    if(user) {
        var q="select songs.*,artist.artistName,album.albumName,genres.genreName from songs inner join artist on artist.artistID=songs.artistID inner join album on album.albumID=songs.albumID inner join genres on genres.genreID=songs.genreID;";
        connection.query(q, function(error,results,fields) {
            if(error) throw error;
            res.render("test",{results:results,user:user});
        });
    } else {
        res.redirect('login');
   }
});
app.get("/signup",function(req, res) {
    var user=req.session.user;
    res.render('signup',{user:user,message:message});
    message="";
});
app.post("/signup",function(req,res) {
    var encryptedPass=bcrypt.hashSync(req.body.password,10);
    var user = {
       fname:req.body.first_name,
       lname:req.body.last_name,
       username:req.body.username,
       password:encryptedPass,
       email:req.body.email
   };
   var q="SELECT * FROM users WHERE username="+"'"+user.username+"'";
   connection.query(q,function(err,results,fields) {
       if(err) throw err;
       if(results[0]) {
           //user already exists
           message="Username already registered";
           res.redirect("/signup");
       } else {
            var sql = "INSERT INTO users(first_name,last_name,email,username,password) VALUES ('" + user.fname + "','" + user.lname + "','" + user.email + "','" + user.username + "','" + user.password + "')";
            connection.query(sql,function(err,results,fields) { 
            if(err) throw err;
            res.redirect('login');
        });
    }
   });

});
app.get('/checkout',function(req, res) {
    var user=req.session.user;
    
    res.render('checkout.ejs',{user:user,price:req.session.price});
});
app.get('/cart',function(req, res) {
    var user=req.session.user;
    var price=0;
    var q="select songs.title,songs.songID,songs.price,cart.addDate from songs inner join cart on cart.songID=songs.songID where cart.userID="+user.userID+";";
    connection.query(q,function(error, results, fields) {
       if(error) throw error;
       results.forEach(function(song) {
          price+=song.price;
       });
       req.session.price=price;
       console.log(price);
       res.render('cart',{user:user,results:results,price:price});
    });
});
app.put("/cart/:songID",function(req, res) {
   var user=req.session.user;
   console.log(req.params.songID);
    var q="delete from cart where songID="+req.params.songID+" and userID="+user.userID+";";
    console.log(q);
    connection.query(q,function(error, results, fields) {
      if (error) throw error;
      console.log(results);
      res.redirect('/cart');
  });
});
app.post("/cart/:songID",function(req, res) {
   var user=req.session.user;
   var q="insert into cart(userID,songID,addDate,addTime) values('"+user.userID+"','"+req.params.songID+"',"+"curdate(),curtime());";
   connection.query(q,function(error, results, fields) {
      if(error) throw error;
  });
   res.redirect('/home');
});
app.post('/checkout/:token',function(req, res) {
    console.log(req.params.token);
    var stripe=require("stripe")('sk_test_9BAjCACDs3ZmEpEue3EscvI8');
    stripe.charges.create({
        amount:Math.round(req.session.price*100),
        currency:'usd',
        source:req.params.token,
        description:'description'
    },function(err,charge){
        if(err) throw err;
        //make cart null and add to library
        var q="select songID,userID from cart where userID="+req.session.user.userID+";";
        connection.query(q,function(error, results, fields) {
            if(error) throw error;
            var query="insert into library(songID,userID) values(";
            results.forEach(function(result) {
                query+=result.songID+","+result.userID+"),(";
            });
            query=query.substring(0,query.length-2);
            query+=";";
            connection.query(query,function(error, results, fields) {
               if(error) throw error;
               var q2='delete from cart where userID='+req.session.user.userID+";";
               connection.query(q2,function(error, results, fields) {
                   if(error) throw error;
                   var q3="insert into payment (userID,amount,addDate,addTime) values('"+req.session.user.userID+"','"+req.session.price+"',"+"curdate(),curtime());";
                   connection.query(q3,function(error, results, fields) {
                      if(error) throw error; 
                      res.redirect('/profile');
                   });
               });
            });
        });
    });
});
app.get('/logout',function(req, res) {
   res.redirect('login');
});
app.get('/paymentHistory',function(req, res) {
    var user=req.session.user;
    var q="select * from payment where userID="+user.userID+";";
    connection.query(q,function(error, results, fields) {
       if(error) throw error;
       res.render('history',{results:results,user:user});
    });
});
app.post('/search',function(req, res) {
   var user=req.session.user;
   var key=req.body.key;
   var q1="select songs.*,artist.artistName,album.albumName,genres.genreName from songs inner join artist on artist.artistID=songs.artistID inner join album on album.albumID=songs.albumID inner join genres on genres.genreID=songs.genreID where songs.title like'"+key+"%' or artist.artistName like'"+key+"%' or album.albumName like'"+key+"%' or genres.genreName like'"+key+"%';";
   connection.query(q1,function(error, results, fields) {
      if(error) throw error;
      res.render('search',{results:results,user:user});
   });
});
app.post('/gift/:songID',function(req, res) {
   var user=req.session.user;
   console.log(user);
   var q="select userID from users where username="+"'"+req.body.username+"'"+";";
   connection.query(q,function(error, results, fields) {
       if(error) throw error;
       console.log(results);
       var q1="insert into library(songID,userID) values("+req.params.songID+","+results[0].userID+");";
       console.log(q1);
       connection.query(q1,function(error, results, fields) {
           if(error) throw error;
           var q2="delete from library where songID="+req.params.songID+" and userID="+user.userID+" limit 1;";
           console.log(q2);
             connection.query(q2,function(error, results, fields) {
                 if(error) throw error;
              res.redirect('/profile');
             });
       });
   });
});

app.listen(process.env.PORT,process.env.IP,function() {
    console.log("Server started!");
}); 