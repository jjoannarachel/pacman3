/**
 * @jest-environment jsdom
 */
import path from 'path';
import aframeMock, { _captured } from 'aframe'; 
import { howlerInstances } from 'howler';

global.AFRAME = aframeMock;

class MockMesh { 
  constructor() { 
    this.isMesh = true; 
    this.material = { name: 'ghostmat', color: { setHex: jest.fn() }, opacity: 1, transparent: false, needsUpdate: false }; 
  } 
}

global.THREE = {
  Vector3: jest.fn((x, y, z) => ({ x, y, z, set: jest.fn().mockReturnThis(), copy: jest.fn().mockReturnThis() })),
  Mesh: MockMesh,
  MathUtils: { degToRad: d => d * Math.PI / 180 }
};

// Global DOM Mock Factory
const mockEl = (overrides = {}) => ({
  addEventListener: jest.fn((ev, cb) => {
    if (ev === 'model-loaded') cb();
    return null;
  }),
  getAttribute: jest.fn(attr => {
    if (attr === 'rotation') return {y:0, x:0, z:0};
    if (attr === 'position') return {x:0, y:0, z:0};
    if (attr === 'nav-agent') return {speed: 0.65};
    return overrides[attr] || {x:0, y:0, z:0};
  }),
  setAttribute: jest.fn(),
  removeAttribute: jest.fn(),
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  getObject3D: jest.fn(() => ({
    traverse: jest.fn(cb => cb(new MockMesh())),
    position: { set: jest.fn() },
    rotation: { set: jest.fn() }
  })),
  object3D: { 
    position: { set: jest.fn(), x:0, y:0, z:0, copy: jest.fn() }, 
    rotation: { set: jest.fn(), y:0 },
    traverse: jest.fn(cb => cb(new MockMesh())),
    appendChild: jest.fn(),
    remove: jest.fn(),
    lookAt: jest.fn()
  },
  sceneEl: { 
    appendChild: jest.fn(), 
    addEventListener: jest.fn((ev, cb) => cb()), 
    exitVR: jest.fn() 
  },
  components: { 'look-controls': { pitchObject: { rotation: {x:0} }, yawObject: { rotation: {y:0} } } },
  style: { display: 'block' }, 
  classList: { add: jest.fn(), remove: jest.fn() }, 
  innerHTML: 'START',
  className: 'fa-volume-up',
  // Fix for the 'reading x' error
  defaultPos: { x: 0, y: 0, z: 0 },
  defaultColor: 0xFF0000,
  ...overrides
});

const soundEl = mockEl();
const startBtn = mockEl();

global.document.getElementById = jest.fn((id) => {
  if (id === 'sound') return soundEl;
  if (id === 'start') return startBtn;
  return mockEl();
});

global.document.querySelector = jest.fn(() => mockEl());
global.document.querySelectorAll = jest.fn(sel => {
  if (sel === '[life]') return [mockEl(), mockEl(), mockEl()];
  if (sel === '[ghost]') return [mockEl({ defaultPos: {x:0, y:0, z:0} })];
  return [mockEl()];
});
global.document.createElement = jest.fn(() => mockEl({ appendChild: jest.fn() }));
global.localStorage = { getItem: jest.fn(), setItem: jest.fn() };

const indexModule = require('../index.js');

describe('Pacman 100% Coverage Suite', () => {
  const getCtx = (name, el = mockEl()) => {
    const def = _captured[name];
    const ctx = { ...def, el };
    Object.keys(def).forEach(k => { if (typeof def[k] === 'function') ctx[k] = def[k].bind(ctx); });
    return ctx;
  };

  beforeEach(() => { 
    jest.useFakeTimers(); 
  });

  test('Exhaustive Logic Path Coverage', () => {
    // 1. Maze Component & Sound Control (Lines 80-133)
    const mazeCtx = getCtx('maze');
    mazeCtx.init();
    
    const clickCall = soundEl.addEventListener.mock.calls.find(c => c[0] === 'click');
    if (clickCall) clickCall[1](); // Toggle Sound branches

    mazeCtx.initLife();
    mazeCtx.initScene(); // REQUIRED: Populates 'path'
    mazeCtx.start();

    // 2. Spacebar Event (Lines 96-109)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); 

    // 3. Player Tick & Tunnel Math (Lines 243-260)
    const playerEl = mockEl();
    const playerCtx = getCtx('player', playerEl);
    playerCtx.player = playerEl;
    playerCtx.init();
    
    indexModule.restart(0); 
    jest.runAllTimers(); 
    
    playerCtx.nextBg = { stop: jest.fn(), play: jest.fn() };
    playerCtx.tick(); 

    // Tunnel Math (i=13 branch)
    playerCtx.updatePlayerDest(-6.4, 0.8, -0.605); 
    playerCtx.updatePlayerDest(6.475, 0.8, -0.605);

    // 4. Ghost Flashing & Modes (Lines 272-282)
    const ghost = mockEl({ dead: false, slow: true, defaultPos: {x:0, y:0, z:0} });
    playerCtx.ghosts = [ghost];
    playerCtx.onEatPill();
    for(let i = 0; i < 71; i++) playerCtx.updateMode({x:0, z:0}); 
    playerCtx.updateGhosts(10, 10); // pillCnt === 1 branch
    
    playerCtx.onEatPill();
    for(let i = 0; i < 60; i++) playerCtx.updateMode({x:0, z:0}); 
    playerCtx.updateGhosts(0, 0); // flashing logic branches

    // 5. Collisions & Death (Lines 340-350, 399-400, 433-452)
    playerCtx.onCollideWithPellets(100, 100); // Hit ternary clamps
    playerCtx.onCollideWithGhost(ghost, 0, 0, 0);
    ghost.slow = false;
    playerCtx.onCollideWithGhost(ghost, 0, 0, 0); // Dies

    playerCtx.onWin();
    playerCtx.onDie(); 
    jest.runAllTimers(); 
    
    for(let i=0; i<4; i++) indexModule.updateLife(); // Drain lives for GameOver
    playerCtx.onDie();
    playerCtx.onPause(true);
    playerCtx.onGameOver(true);

    // 6. Exports & Callbacks
    indexModule.setOpacity(mockEl({ getObject3D: () => null }), 0.5);
    indexModule.enableCamera();
    jest.runAllTimers();

    const readyHowl = howlerInstances.find(i => i.src && i.src[0].includes('ready'));
    if (readyHowl) readyHowl.onend();
  });
});