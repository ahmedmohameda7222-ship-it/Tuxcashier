const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.js");
let source = fs.readFileSync(appPath, "utf8");
const original = source;

const updateDeviceModeGuard = /  const updateDeviceMode = useCallback\(\n    async \(deviceId, mode\) => \{\n      if \(!currentDeviceCanAdmin\) \{\n        alert\("This device is not allowed to manage connected devices\."\);\n        return;\n      \}\n/;

source = source.replace(
  updateDeviceModeGuard,
  "  const updateDeviceMode = useCallback(\n    async (deviceId, mode) => {\n"
);

source = source.replace(
  /    \[currentDeviceCanAdmin, dayMeta\.currentWorker, refreshDevices\]\n  \);/, 
  "    [dayMeta.currentWorker, refreshDevices]\n  );"
);

source = source.replace(
  /\n\s+disabled=\{!currentDeviceCanAdmin \|\| isCurrent\}/,
  ""
);

if (source !== original) {
  fs.writeFileSync(appPath, source, "utf8");
  console.log("Device mode admin restrictions removed from src/App.js.");
} else {
  console.log("Device mode admin restrictions were already removed or the target code changed.");
}
