import app from '../src/server';

// @ts-ignore
if (typeof module !== 'undefined' && module.exports) {
  // @ts-ignore
  module.exports = app;
  // @ts-ignore
  module.exports.default = app;
  // @ts-ignore
  module.exports.app = app;
}

export default app;
