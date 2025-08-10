require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 3000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
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

    app.put('/articles/:id',async (req,res)=>{
      const id = req.params.id;
      const updated = req.body;
      const result = await articleCollection.updateOne(
        {
          _id:new ObjectId(id)
        },
        {
          $set:updated
        }
      );
      res.send(result);
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

    app.get("/likes/:articleId", async(req,res)=>{
      const articleId = req.params.articleId;

      try{

        const count = await likeCollection.countDocuments({articleId});

        res.send({totalLikes: count });
      } catch(err){
        console.error("Error getting like count:", err);
        res.status(500).send("Failed to get like count");
      }
    })
    

   

    
    

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