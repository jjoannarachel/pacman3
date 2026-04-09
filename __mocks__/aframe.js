const capturedComponents = {};
export const registerComponent = jest.fn((name, def) => {
  capturedComponents[name] = def;
});
export const utils = { throttleTick: jest.fn(fn => fn) };
export const _captured = capturedComponents; 
export default { registerComponent, utils };