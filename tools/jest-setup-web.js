// jsdom gaps for the react-native-web test project (*.test.web.tsx).

// Reanimated reads the reduced-motion preference at import time.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

// jsdom has no layout engine: report each observed view once so onLayout fires.
if (typeof window.ResizeObserver !== 'function') {
  window.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      this.callback([{ target }], this);
    }
    unobserve() {}
    disconnect() {}
  };
}
