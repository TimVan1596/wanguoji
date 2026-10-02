const expected = process.argv[2];
if (expected !== process.platform) {
  console.error(`This packaging target must run on ${expected}; current platform is ${process.platform}.`);
  process.exitCode = 1;
}
