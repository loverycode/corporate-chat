import * as dotenv from 'dotenv';
import { resolve } from 'path';

export default async () => {
  dotenv.config({ path: resolve(__dirname, '../.env.test') });
};