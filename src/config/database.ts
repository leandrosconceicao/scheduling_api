import mongoose from "mongoose";
import { env } from "./env";

mongoose.set("strictQuery", false);

mongoose.connect(env.DB_URL);

export default mongoose.connection;
