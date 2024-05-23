require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { format } = require("date-fns");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster12.pgm0rcv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster12`;

const intervals = new Map();
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB!");

    const processCollection = client
      .db(process.env.DB_NAME)
      .collection("process");
    const logCollection = client.db(process.env.DB_NAME).collection("log");

    app.post("/create-process", async (req, res) => {
      try {
        // const { id } = req.body;
        let id= Math.random().toString(36).substr(2, 8);
        const createTime = new Date();
        const formattedDate = format(createTime, "hh:mm a dd M yyyy");
        const newProcess = { PID: id, creationTime: formattedDate };

        const result = await processCollection.insertOne(newProcess);
        const intervalId = setInterval(async () => {
          try {
            const logTime = new Date();
            const logFormattedDate = format(logTime, "hh:mm a dd M yyyy");
            const logData = { PID: id, creationTime: logFormattedDate };
            await logCollection.insertOne(logData);
          } catch (error) {
            console.error("Error inserting log", error);
          }
        }, 5000);

        intervals.set(id, intervalId);
        res.send({
          PID: newProcess.PID,
          creationTime: newProcess.creationTime,
        });
      } catch (error) {
        console.error("Error inserting process", error);
        res
          .status(500)
          .send({ status: "error", message: "Internal Server Error" });
      }
    });

    app.get("/get-all", async (req, res) => {
      try {
        const result = await processCollection.find({}).toArray();
        const data = result.map((element) => ({
          PID: element.PID,
          creationTime: element.creationTime,
        }));
        res.send(data);
      } catch (error) {
        console.error("Error getting processes", error);
        res
          .status(500)
          .send({ status: "error", message: "Internal Server Error" });
      }
    });

    app.get("/get-single", async (req, res) => {
      try {
        const { id } = req.body;
        const result = await logCollection.find({ PID: id }).toArray();
        const data = result.map((element) => element.creationTime);
        res.send({ logs: data });
      } catch (error) {
        console.error("Error getting single process logs", error);
        res
          .status(500)
          .send({ status: "error", message: "Internal Server Error" });
      }
    });

    app.delete("/delete-process", async (req, res) => {
      try {
        const { id } = req.body;
        const query = { PID: id };

        const processResult = await processCollection.deleteOne(query);
        const logDeleteResult = await logCollection.deleteMany(query);

        // Clear the interval associated with the process ID
        const intervalId = intervals.get(id);
        if (intervalId) {
          clearInterval(intervalId);
          intervals.delete(id);
        }

        res.send({
          status: "success",
          message: `PID - ${id}: Process and logs successfully deleted`,
          processResult,
          logDeleteResult,
        });
      } catch (error) {
        console.error("Error deleting process and logs", error);
        res
          .status(500)
          .send({ status: "error", message: "Internal Server Error" });
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
    process.exit(1); // Exit process with failure
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Process Management Server is running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
