require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors({
   origin: "https://assi11-knowledge-sharing.web.app",
  credentials: true, 
}));
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oeflzv2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// for firebase token admin
const admin = require("firebase-admin");

// ✅ Use correct env variable name
//...fire base sevice key
const base64Key = process.env.FIREBASE_SERVICE_KEY;
const serviceAccountJSON = Buffer.from(base64Key, 'base64').toString('utf8');
const serviceAccount = JSON.parse(serviceAccountJSON);


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log("❌ No Authorization header");
    return res.status(401).send({ error: true, message: "Unauthorized: No token" });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log("❌ Token missing in Bearer format");
    return res.status(401).send({ error: true, message: "Unauthorized: Invalid format" });
  }

  admin.auth().verifyIdToken(token)
    .then(decoded => {
      console.log("✅ Token verified:", decoded.email);
      req.decoded = decoded;
      next();
    })
    .catch((error) => {
      console.log("❌ Token verification failed:", error.message);
      return res.status(401).send({ error: true, message: "Unauthorized: Invalid token" });
    });
};




async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const articleCollection = client.db("articleDB").collection("articles");

    // comments collection

    const commentCollection = client.db("articleDB").collection("comments")

    // likes collection

    const likeCollection =client.db("articleDB").collection("likes")
    // BookMarked Collection
    const bookmarkCollection = client.db("articleDB").collection("bookmarks");
    // Users Collection 
    const usersCollection = client.db("articleDB").collection("users");
    // Quizz collection
    const quizCollection = client.db("articleDB").collection("quizzes");
    // notification Collection
    const notificationCollection = client.db("articleDB").collection("notifications");

  // ActivityLog Collection
  const activityCollection = client.db("articleDB").collection("activities");

    

    app.post('/articles',verifyJWT, async (req, res) => {
      const article = req.body;
      const result = await articleCollection.insertOne(article);
      res.send(result);
    });

    // 🔹 Read All Articles
    app.get('/articles', async (req, res) => {
      const category =req.query.category;
      const email =req.query.email;
      let query ={};
      if(category){
        query ={category};
      }
      if(email){
        query.email =email;
      }
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });  

    app.get("/categories/name", async (req, res) => {
  try {
    const categories = await articleCollection.aggregate([
      {
        $group: {
          _id: "$category"
        }
      },
      {
        $project: {
          _id: 0,
          category: "$_id"
        }
      }
    ]).toArray();

    res.send(categories.map(item => item.category));
  } catch (err) {
    console.error("Failed to fetch categories:", err);
    res.status(500).send("Error fetching categories");
  }
});


    app.get("/articles/:id",async(req,res)=>{
      const {id}=req.params;
      const article =await articleCollection.findOne({_id: new ObjectId(id) });
      res.send(article);
    });

    // update Article

    app.put("/articles/:id", async (req, res) => {
  const id = req.params.id;
  const email = req.user.email; // from JWT token
  const article = await articlesCollection.findOne({ _id: new ObjectId(id) });

  if (article.authorEmail !== email) {
    return res.status(403).send({ message: "Unauthorized to update this article!" });
  }

  const updatedData = req.body;
  await articlesCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedData }
  );

  res.send({ message: "Article updated successfully!" });
});

     // Delete Article

    app.delete('/articles/:id', async(req,res)=>{
      const id = req.params.id;
      const result = await articleCollection.deleteOne({_id:new ObjectId(id)})
      res.send(result);
    });


    // comment Collection ApI

    app.post ("/comments",async(req,res)=>{
      const comment = req.body;

      try {
        const result = await commentCollection.insertOne(comment);
        res.send(result);
      } catch (err){
        console.error("Error posting comment:", err);
        res.status(500).send("Failed to post comment");
      }
    });

    app.get("/comments/:articleId",async(req,res)=>{
      const articleId = req.params.articleId;
      try{
        const comments = await commentCollection
        .find({articleId})
        .sort({timestamp: -1})
        .toArray();
        res.send(comments)
      } catch (err){
        console.error("Error fetching comments:", err);
        res.status(500).send("Failed to fetch comments");
      }
    });



    // Likes ApI


    app.post("/likes",async(req,res)=>{
      const {articleId,userEmail}=req.body;

      try{
        const alreadyLiked = await likeCollection.findOne({articleId,userEmail});

        if(alreadyLiked) {
          return res.status(400).send({message:"You already liked this article." });

        }
        

        const result = await likeCollection.insertOne({
          articleId,
          userEmail,
          timestamp:new Date()
        });

        res.send(result);

      } catch (err) {
        console.error("Error liking article:", err);
        res.status(500).send("Failed to like article");
      }
    });

    app.get("/likes/:articleId", async (req, res) => {
  const articleId = req.params.articleId;
  const userEmail = req.query.userEmail;

  try {
    const totalLikes = await likeCollection.countDocuments({ articleId });
    let userLiked = false;

    if (userEmail) {
      const like = await likeCollection.findOne({ articleId, userEmail });
      userLiked = !!like;
    }

    res.send({ totalLikes, userLiked });
  } catch (err) {
    console.error("Error getting like count:", err);
    res.status(500).send("Failed to get like count");
  }
});

    
    app.delete("/likes", async (req, res) => {
  const { articleId, userEmail } = req.body;
  try {
    const result = await likeCollection.deleteOne({ articleId, userEmail });
    res.send(result);
  } catch (err) {
    res.status(500).send("Failed to unlike article");
  }
});
 // ✅ Add a bookmark
app.post("/bookmarks", verifyJWT, async (req, res) => {
  const { articleId } = req.body;
  const userEmail = req.decoded.email;

  try {
    // Prevent duplicate bookmarks
    const alreadyBookmarked = await bookmarkCollection.findOne({ articleId, userEmail });
    if (alreadyBookmarked) {
      return res.status(400).send({ message: "Article already bookmarked" });
    }

    const result = await bookmarkCollection.insertOne({
      articleId,
      userEmail,
      timestamp: new Date(),
    });

    res.send(result);
  } catch (err) {
    console.error("Error adding bookmark:", err);
    res.status(500).send({ message: "Failed to bookmark article" });
  }
});

// ✅ Get all bookmarks for a user
app.get("/bookmarks", verifyJWT, async (req, res) => {
  const userEmail = req.decoded.email;
  try {
    const bookmarks = await bookmarkCollection.find({ userEmail }).toArray();

    // Optionally, populate article info
    const articleIds = bookmarks.map(b => new ObjectId(b.articleId));
    const articles = await articleCollection.find({ _id: { $in: articleIds } }).toArray();

    res.send(articles);
  } catch (err) {
    console.error("Error fetching bookmarks:", err);
    res.status(500).send({ message: "Failed to fetch bookmarks" });
  }
});

// ✅ Delete bookmark
app.delete("/bookmarks/:articleId", verifyJWT, async (req, res) => {
  const { articleId } = req.params;
  const userEmail = req.decoded.email;

  try {
    const result = await bookmarkCollection.deleteOne({ articleId, userEmail });
    res.send(result);
  } catch (err) {
    console.error("Error deleting bookmark:", err);
    res.status(500).send({ message: "Failed to remove bookmark" });
  }
});

// ✅ POST — Save user to DB (register or first login)
app.post("/users", async (req, res) => {
  const user = req.body;
  if (!user?.email) return res.status(400).send({ message: "Email required" });

  const existingUser = await usersCollection.findOne({ email: user.email });
  if (existingUser) {
    return res.send({ message: "User already exists", insertedId: null });
  }

  const result = await usersCollection.insertOne(user);
  res.send(result);
});

// ✅ GET — Get all users
app.get("/users", async (req, res) => {
  const users = await usersCollection.find().toArray();
  res.send(users);
});

// ✅ GET — Get one user by email
app.get("/users/:email", async (req, res) => {
  const email = req.params.email;
  const user = await usersCollection.findOne({ email });
  res.send(user);
});

// ✅ PATCH — Update user role (e.g., make admin)
app.patch("/users/:id", async (req, res) => {
  const id = req.params.id;
  const updateDoc = { $set: req.body };
  const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);
  res.send(result);
});

// ✅ DELETE — Remove user
app.delete("/users/:id", async (req, res) => {
  const id = req.params.id;
  const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});
  // ✅ Create Quiz
app.post("/quizzes", async (req, res) => {
  try {
    const quiz = req.body;
    const result = await quizCollection.insertOne(quiz);
    res.send(result);
  } catch (err) {
    console.error("Error adding quiz:", err);
    res.status(500).send("Failed to add quiz");
  }
});

// ✅ Get All Quizzes
app.get("/quizzes", async (req, res) => {
  try {
    const result = await quizCollection.find().toArray();
    res.send(result);
  } catch (err) {
    console.error("Error fetching quizzes:", err);
    res.status(500).send("Failed to fetch quizzes");
  }
});

// ✅ Get Single Quiz by ID
app.get("/quizzes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const quiz = await quizCollection.findOne({ _id: new ObjectId(id) });
    res.send(quiz);
  } catch (err) {
    console.error("Error fetching quiz:", err);
    res.status(500).send("Failed to fetch quiz");
  }
});

    // 🔔 Create Notification (e.g., comment, like, featured)
  app.post("/notifications", async (req, res) => {
    try {
      const { recipientEmail, senderEmail, type, message, articleId } = req.body;
      const result = await notificationCollection.insertOne({
        recipientEmail,
        senderEmail,
        type,
        message,
        articleId,
        isRead: false,
        timestamp: new Date(),
      });
      res.send(result);
    } catch (err) {
      console.error("Error creating notification:", err);
      res.status(500).send("Failed to create notification");
    }
  });

  // 🔔 Get user notifications
  app.get("/notifications/:email", async (req, res) => {
    try {
      const email = req.params.email;
      const notifications = await notificationCollection
        .find({ recipientEmail: email })
        .sort({ timestamp: -1 })
        .toArray();
      res.send(notifications);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      res.status(500).send("Failed to fetch notifications");
    }
  });

  // ✅ Mark notification as read
  app.patch("/notifications/read/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = await notificationCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isRead: true } }
      );
      res.send(result);
    } catch (err) {
      res.status(500).send("Failed to mark notification as read");
    }
  });

  // 📜 Add activity log (any action)
  app.post("/activities", async (req, res) => {
    try {
      const { userEmail, action, articleId } = req.body;
      const result = await activityCollection.insertOne({
        userEmail,
        action,
        articleId,
        timestamp: new Date(),
      });
      res.send(result);
    } catch (err) {
      console.error("Error adding activity:", err);
      res.status(500).send("Failed to add activity");
    }
  });

  // 📜 Get activity logs for a user
  app.get("/activities/:email", async (req, res) => {
    try {
      const email = req.params.email;
      const logs = await activityCollection
        .find({ userEmail: email })
        .sort({ timestamp: -1 })
        .toArray();
      res.send(logs);
    } catch (err) {
      console.error("Error fetching activities:", err);
      res.status(500).send("Failed to fetch activities");
    }
  });
  



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





 app.get('/',(req,res)=>{
 res.send('Knowledge Server Connected ')
})

app.listen(port,()=>{
    console.log(`Knowledge Code Server is Running on port ${port}`)
})