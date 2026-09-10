import * as dotenv from 'dotenv';
import { resolve } from 'path';

export default () => {
  dotenv.config({ path: resolve(__dirname, '../.env.test') });
};
