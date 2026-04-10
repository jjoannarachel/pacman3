import { maze, intersections } from '../config';

describe('Configuration Data Validation', () => {
  test('Maze and Intersection constants are correctly exported', () => {
    expect(maze).toBeDefined();
    expect(intersections).toBeDefined();
    expect(Array.isArray(maze)).toBe(true);
  });
});