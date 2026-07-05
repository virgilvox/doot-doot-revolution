// avatar: the three.js VRM dancer stage, exposed as the render subpath
// "@doot-games/render/avatar". Kept out of the package barrel (index.js) on purpose:
// three and the VRM libraries load only when something imports this path, so they ride
// a lazy chunk and never touch the base bundle. The app dynamic-imports it when the
// dancer setting is on. See the sibling modules for the pure, Node-testable pieces.

export { createDancerStage } from './stage.js';
export { tierFor, THRESH } from './director.js';
export { MOVES } from './moves.js';
