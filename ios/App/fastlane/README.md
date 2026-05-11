fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios beta

```sh
[bundle exec] fastlane ios beta
```

TestFlight Beta Build hochladen

### ios release

```sh
[bundle exec] fastlane ios release
```

App Store Release (Patch Version Bump)

### ios build_only

```sh
[bundle exec] fastlane ios build_only
```

Nur bauen, nicht hochladen (fuer lokale Tests)

### ios sync_certs

```sh
[bundle exec] fastlane ios sync_certs
```

Certificates und Profiles via match syncen

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
