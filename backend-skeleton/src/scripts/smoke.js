const baseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3001';

async function check(path) {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();

  return {
    path,
    status: res.status,
    ok: res.ok,
    body: text,
  };
}

async function main() {
  const paths = ['/', '/health', '/configz', '/readyz'];

  for (const path of paths) {
    try {
      const result = await check(path);
      console.log(`\n[${result.status}] ${result.path}`);
      console.log(result.body);
    } catch (error) {
      console.log(`\n[ERROR] ${path}`);
      console.log(error.message || String(error));
      process.exitCode = 1;
    }
  }
}

main();
