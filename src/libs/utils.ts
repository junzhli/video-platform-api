import bcrypt from "bcrypt";
import fs from "fs";
import { promisify } from "util";

export const genSalt = promisify(bcrypt.genSalt).bind(bcrypt);
export const hash = promisify(bcrypt.hash).bind(bcrypt);
export const compare = promisify(bcrypt.compare).bind(bcrypt);

export const readFile = promisify(fs.readFile).bind(fs);
export const removeFile = promisify(fs.unlink).bind(fs);
export const getStat = promisify(fs.stat).bind(fs);