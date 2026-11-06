module.exports = (options) => {
  return {
    ...options,
    plugins: options.plugins.filter(
      (p) => p.constructor && p.constructor.name !== 'ForkTsCheckerWebpackPlugin',
    ),
  };
};
