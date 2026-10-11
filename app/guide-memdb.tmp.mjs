import { MongoMemoryServer } from "mongodb-memory-server";
const m = await MongoMemoryServer.create({ instance: { port: 27999 } });
console.log("URI", m.getUri());
setInterval(() => {}, 1 << 30);
