import { maze, intersections } from '../config';

describe('Config Data', () => {
  test('maze and intersections are defined', () => {
    expect(maze).toBeDefined();
    expect(intersections).toBeDefined();
  });
});