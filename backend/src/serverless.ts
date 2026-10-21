import { createApp } from './app';

const app = createApp();

const handler = (req: any, res: any) => {
  return app(req, res);
};

export default handler;
