// Simple test function to confirm Netlify Functions are wired up.
exports.handler = async function() {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from Netlify Functions; functions are wiring correctly." }),
  };
};
