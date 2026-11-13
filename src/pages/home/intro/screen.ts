// The smallest window the intro plays in. Below it the formations would be too small to read (a
// phone) or the stage too squeezed (a short laptop window, a phone on its side), so the home page
// is the plain hero there, from the first paint, as with reduced motion.
//
// This is the one place these numbers live: Intro.tsx watches the query, vite.config.ts writes it
// into index.html's head script (which decides before the first paint), and the e2e tests use it.
// Keep this file free of browser APIs; vite.config.ts imports it in Node.

/** At 1024 px and wider the hero is two columns (Home.css stacks them below 960 px). */
export const INTRO_MIN_WIDTH = 1024;
/** At 600 px and taller the stage keeps room for a formation and its label beside the text. */
export const INTRO_MIN_HEIGHT = 600;

/** The media query for a window the intro plays in. */
export const INTRO_SCREEN = `(min-width: ${INTRO_MIN_WIDTH}px) and (min-height: ${INTRO_MIN_HEIGHT}px)`;

/** The placeholder in index.html's head script that the build replaces with INTRO_SCREEN. */
export const INTRO_SCREEN_PLACEHOLDER = "%INTRO_SCREEN%";
