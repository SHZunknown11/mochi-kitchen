// React bridge module for Mochi Kitchen
export const React = window.React;
export const ReactDOM = window.ReactDOM;
export const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useReducer,
} = window.React || {};

/**
 * Helper to create a React element without JSX
 */
export const e = window.React ? window.React.createElement : null;

/**
 * Mount a React component into a container element.
 * Returns { root, unmount, update }
 */
export function mountReact(Component, container, props = {}) {
  if (!window.ReactDOM || !window.React) {
    console.warn('React or ReactDOM is not loaded on window.');
    return null;
  }
  const root = window.ReactDOM.createRoot(container);
  root.render(window.React.createElement(Component, props));
  return {
    root,
    update: (nextProps) => root.render(window.React.createElement(Component, nextProps)),
    unmount: () => root.unmount(),
  };
}

