const { withGradleProperties, withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withArm64Only(config) {
  // 1. Set gradle.properties for React Native architectures and resource shrinking
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) =>
        item.key !== "reactNativeArchitectures" &&
        item.key !== "android.enableShrinkResourcesInReleaseBuilds"
    );
    cfg.modResults.push({
      type: "property",
      key: "reactNativeArchitectures",
      value: "arm64-v8a",
    });
    cfg.modResults.push({
      type: "property",
      key: "android.enableShrinkResourcesInReleaseBuilds",
      value: "true",
    });
    return cfg;
  });

  // 2. Add ndk abiFilters to defaultConfig in android/app/build.gradle
  config = withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes("abiFilters")) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {\n        ndk {\n            abiFilters "arm64-v8a"\n        }`
      );
    }
    return cfg;
  });

  return config;
};

