import { app } from './app';
import { env } from './config/env';
import { logger } from './middlewares/logger.middleware';

app.listen(env.PORT, () => logger.info(`MecaniBot API listening on port ${env.PORT}`));
