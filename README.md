
# Description

Given a previously signed add-on XPI file, this script creates or updates the `update.json` manifest required for automatic add-on updates.

# Install

```
npm install -g firefox-addons-add-update-version
```

# Usage

```
faauv [options] <xpi file path>
```

## Options

- `--update-in <update.json file path>`: path to original `update.json` manifest. If not specified, a new manifest is assumed
- `--update-out <update.json file path>`: path to `update.json` manifest to be created
- `--update <update.json file path>`: shortcut to specify both `--update-in` and `--update-out` for the same path
- `--update-link <url where to download xpi>`: update link to download new add-on version

## Notes

  When using the `--update-link` option, you can use the placeholder `@version@` to be replaced by the new add-on version string.

  If former versions already exist in the original `update.json`, all the extra parameters (e.g `{"applications":{"gecko":{"strict-minimum-version":"..."}}}`) from the latest version are re-used in the new entry.

  This is also the case for the `update_link` property, if not specified as command line parameter, with the version string being replaced in the url. For instance if a previous version _1.0.1_ had `update_link` _https://mysite.com/download?v=1.0.1_ and you add version _1.0.2_ without specifying the `--update-link` option, the new entry will automatically set `update_link` to _https://mysite.com/download?v=1.0.2_.
