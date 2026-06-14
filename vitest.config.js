module.exports = {
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    globals: false,
    testTimeout: 10_000,
    reporters: ['verbose'],
  },
};
