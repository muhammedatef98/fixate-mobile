// Raises the Gradle JVM memory in android/gradle.properties on every prebuild.
//
// Why: release builds run KSP (Kotlin Symbol Processing) for expo-updates etc.,
// which is metaspace-hungry. The Expo default
//   org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
// runs out with `java.lang.OutOfMemoryError: Metaspace` on `:expo-updates:
// kspReleaseKotlin`. `prebuild --clean` regenerates gradle.properties, so a
// hand-edit is wiped each run — this plugin re-applies the bump deterministically.
//
// withGradleProperties exposes the parsed key/value entries; we update the
// existing org.gradle.jvmargs entry in place (or append it), leaving every other
// Gradle property untouched.
const { withGradleProperties } = require('expo/config-plugins');

// Headroom over the defaults: 4g heap, 2g metaspace. UTF-8 + heap dump on OOM
// for easier diagnosis if it ever recurs on a leaner machine.
const JVM_ARGS =
  '-Xmx4096m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

module.exports = function withGradleMemory(config, props = {}) {
  const jvmArgs = props.jvmArgs || JVM_ARGS;
  return withGradleProperties(config, (cfg) => {
    const entries = cfg.modResults;
    const existing = entries.find(
      (e) => e.type === 'property' && e.key === 'org.gradle.jvmargs'
    );
    if (existing) {
      existing.value = jvmArgs;
    } else {
      entries.push({ type: 'property', key: 'org.gradle.jvmargs', value: jvmArgs });
    }
    return cfg;
  });
};
