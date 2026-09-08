const mongoose = require("mongoose");
const dns = require("dns");
const config = require("./default");
const logger = require("../logger");

const connectDb = async () => {
  try {
    dns.setServers(["8.8.8.8", "8.8.4.4"]);
    await mongoose.connect(config.url, { serverSelectionTimeoutMS: 5000 });
    logger.info("DB Connected");
  } catch (err) {
    if (String(process.env.ALLOW_IN_MEMORY_DB).toLowerCase() === "true") {
      logger.warn("MongoDB connection failed; using in-memory DB because ALLOW_IN_MEMORY_DB=true");
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
      logger.info("In-memory MongoDB started");
      return;
    }
    logger.error(`MongoDB connection failed: ${err.message}`);
    throw err;
  }
};

module.exports = connectDb;
