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
  Vector3: jest.fn((x, y, z) => ({ 
    x, y, z, 
    set: jest.fn().mockReturnThis(), 
    copy: jest.fn().mockReturnThis() 
  })),
  Mesh: MockMesh,
  MathUtils: { degToRad: d => d * Math.PI / 180 }
};

const mockEl = (overrides = {}) => ({
  addEventListener: jest.fn((ev, cb) => (ev === 'model-loaded' || ev === 'enter-vr' || ev === 'exit-vr' ? cb() : null)),
  getAttribute: jest.fn(attr => (attr === 'rotation' ? {y:0, x:0, z:0} : {x:0, y:0, z:0})),
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
  defaultPos: { x: 0, y: 0, z: 0 },
  defaultColor: 0xFF0000,
  ...overrides
});

global.document = {
  getElementById: jest.fn((id) => {
    const el = mockEl();
    if (id === 'start') el.innerHTML = 'START';
    return el;
  }),
  querySelector: jest.fn((sel) => (sel === 'a-camera' ? mockEl() : mockEl())),
  querySelectorAll: jest.fn(sel => sel === '[life]' ? [mockEl(), mockEl(), mockEl()] : [mockEl()]),
  createElement: jest.fn(() => mockEl({ appendChild: jest.fn() }))
};
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

  afterEach(() => { 
    jest.runOnlyPendingTimers(); 
    jest.useRealTimers(); 
  });

  test('Logic Coverage', () => {
    // 1. Maze Setup & VR Branches (Lines 80-201, 100-111, 185)
    const mazeCtx = getCtx('maze');
    mazeCtx.init();
    mazeCtx.initLife();
    mazeCtx.initScene();
    
    // Trigger VR branches
    const sceneEl = mazeCtx.el.sceneEl;
    const enterVrCb = sceneEl.addEventListener.mock.calls.find(c => c[0] === 'enter-vr')[1];
    const exitVrCb = sceneEl.addEventListener.mock.calls.find(c => c[0] === 'exit-vr')[1];
    enterVrCb();
    exitVrCb();

    document.getElementById.mockReturnValueOnce(null); // Line 185
    mazeCtx.initStartButton();
    mazeCtx.start();

    // 2. Player Logic & Tick (Lines 216-238)
    const playerEl = mockEl();
    const playerCtx = getCtx('player', playerEl);
    playerCtx.player = playerEl;
    playerCtx.init();
    
    // Trigger the Tick branch (Line 216)
    // indexModule.restart(0) sets 'dead = false' and fills 'path'
    indexModule.restart(0); 
    jest.runAllTimers(); 
    playerCtx.tick(); 

    // 3. Tunnel Branches (Lines 254-256)
    // We need indices i=13, j=0 and i=13, j=25
    // step=0.515, startX=-6.4, startZ=-7.3
    // i = round((z - startZ)/step) -> z = 13*0.515 - 7.3 = -0.605
    // j = round((x - startX)/step)
    playerCtx.updatePlayerDest(-6.4, 0.8, -0.605); // Tunnel Left (j=0)
    playerCtx.updatePlayerDest(6.475, 0.8, -0.605); // Tunnel Right (j=25)
    playerCtx.updatePlayerDest(0, 0.8, 0); // Standard movement branch (Line 260)

    // 4. Ghost Flashing & Mode Logic (Lines 272-282, 296)
    const ghostEl = mockEl({ dead: false, slow: true });
    playerCtx.ghosts = [ghostEl];
    
    // Hit pillCnt === 1 (Line 272)
    playerCtx.onEatPill(); 
    for(let i = 0; i < 69; i++) playerCtx.updateMode({x:0, z:0}); 
    playerCtx.updateGhosts(10, 10); 
    
    // Hit pillCnt < 20 and even (Line 279 - Flashing)
    playerCtx.onEatPill();
    for(let i = 0; i < 60; i++) playerCtx.updateMode({x:0, z:0}); 
    playerCtx.updateGhosts(0, 0);
    
    // Hit targetPos branch (Line 296)
    for(let i = 0; i < 100; i++) playerCtx.updateMode({x:0, y:0, z:0});

    // 5. Collisions (Lines 342-343, 361-363)
    playerCtx.hitGhosts = [];
    playerCtx.onCollideWithPellets(-6.4, -7.3); // Powerpill (maze[0]=2)
    playerCtx.onCollideWithPellets(100, 100); // Clamp branches (Lines 342-343)
    
    playerCtx.onCollideWithGhost(ghostEl, 0, 0, 0);
    ghostEl.slow = false;
    playerCtx.onCollideWithGhost(ghostEl, 0, 0, 0);
    
    // 6. Die & Restart Branches (Lines 430-431)
    playerCtx.onWin();
    playerCtx.onDie(); // lifeCnt is 3, hits "Restart" branch
    jest.runAllTimers();
    
    // Force Game Over branch
    for(let i=0; i<4; i++) indexModule.updateLife(); // Drain lives
    playerCtx.onDie(); 
    playerCtx.onGameOver(true);

    // 7. Ghost & Exports (Lines 576-579, 612)
    const ghostCtx = getCtx('ghost');
    ghostCtx.data = 'red';
    ghostCtx.init();
    ghostCtx.el.dead = true;
    ghostCtx.onNavEnd();
    
    const readyHowl = howlerInstances.find(i => i.src && i.src[0].includes('ready'));
    if (readyHowl) readyHowl.onend();

    indexModule.disableCamera();
    indexModule.enableCamera(); // Hits camera reset timeout (Line 545)
    jest.runAllTimers();
    
    indexModule._getMazeComponent().initSoundControl(); // Line 612
  });
});