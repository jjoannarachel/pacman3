export const howlerInstances = [];
export const Howl = jest.fn().mockImplementation(function(opts) {
  this.play = jest.fn();
  this.stop = jest.fn();
  this.mute = jest.fn();
  this.src = opts.src;
  this.onend = opts.onend;
  howlerInstances.push(this);
  return this;
});