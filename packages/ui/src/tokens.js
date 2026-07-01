// ui tokens: the arcade candy palette and scale, mirrored here as data so logic
// and canvas code can read the same values the CSS uses. The CSS in css.js is
// the source of truth for styling; this object is the source of truth for any
// JavaScript that needs a hex or a spacing step.

export const tokens = {
  color: {
    ink: '#22203F', ink2: '#15132c', paper: '#FFFDF7', cream: '#FFF4E2',
    red: '#FF4D5E', blue: '#3E7BFF', yellow: '#FFC83D', green: '#2EC56B',
    purple: '#9B5CFF', pink: '#FF5CA8', orange: '#FF9B2E', teal: '#2EC8D6'
  },
  // player coding p1..p4 and difficulty coding beg..cha
  player: { p1: '#FF4D5E', p2: '#3E7BFF', p3: '#2EC56B', p4: '#FFC83D' },
  difficulty: {
    beginner: '#2EC8D6', basic: '#2EC56B', difficult: '#FF9B2E',
    expert: '#FF4D5E', challenge: '#9B5CFF'
  },
  space: { s1: 6, s2: 10, s3: 16, s4: 24, s5: 36 },
  radius: { r1: 12, r2: 18, r3: 26 },
  font: {
    display: "'Baloo 2',system-ui,sans-serif",
    ui: "'Outfit',system-ui,sans-serif"
  },
  ease: {
    spring: 'cubic-bezier(.34,1.7,.5,1)',
    flat: 'cubic-bezier(.4,0,.2,1)'
  }
};

// CSS variable name for a difficulty key, matching the --d-* variables.
export const DIFF_VAR = {
  beginner: '--d-beg', basic: '--d-bas', difficult: '--d-dif',
  expert: '--d-exp', challenge: '--d-cha'
};
