const http = require('http');

async function measure(path, token = null) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(`http://localhost:5000/api/v1${path}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const time = Date.now() - start;
        console.log(`[${res.statusCode}] ${path}: ${time}ms - ${data.length} bytes`);
        resolve({ time, status: res.statusCode, size: data.length, data });
      });
    });
    req.on('error', err => {
      console.log(`[ERROR] ${path}: ${err.message}`);
      resolve(null);
    });
  });
}

async function run() {
  console.log("Starting Benchmark...");
  
  // 1. Initial Loading (Settings, Cart)
  await measure('/settings');
  await measure('/cart');
  
  // 2. Navigation / Categories
  await measure('/categories');
  
  // 3. Products (Catalog & Detailed)
  await measure('/products?page=1&limit=12');
  const products = await measure('/products?page=1&limit=2');
  let slug = "not-found";
  try {
    const data = JSON.parse(products.data);
    if (data.data?.items?.[0]) slug = data.data.items[0].slug;
  } catch(e) {}
  await measure(`/products/${slug}`);
  
  // 4. Admin Dashboard
  // We need an admin token. Let's just measure the public endpoints for now.
}

run();
