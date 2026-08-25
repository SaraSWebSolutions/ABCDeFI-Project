// Preload stub for @nomicfoundation/edr to avoid loading native binaries
const NativeModule = require('module');
const originalLoad = NativeModule._load;
NativeModule._load = function(request, parent, isMain) {
  try {
    if (request === '@nomicfoundation/edr' || request.startsWith('@nomicfoundation/edr-')) {
      return {};
    }
  } catch (e) {}
  return originalLoad.apply(this, arguments);
};
console.log('[mock-edr] preloaded - @nomicfoundation/edr will be stubbed');
