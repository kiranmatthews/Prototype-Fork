// Hosted VMs can lack a usable hardware GL context. This is a test-only backend;
// production launches keep Chromium's hardware defaults and sandbox.
export const softwareGpuTest = process.env.BONEMAN_TEST_SOFTWARE_GPU === '1';
export const testGpuArgs = softwareGpuTest ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
