# Check-in Application

[GitHub Repository](https://github.com/digital-blueprint/checkin-app) |
[npmjs package](https://www.npmjs.com/package/@digital-blueprint/checkin-app) |
[Unpkg CDN](https://unpkg.com/browse/@digital-blueprint/checkin-app/) |
[Checkin Bundle](https://github.com/digital-blueprint/relay-checkin-bundle) |
[Project documentation](https://dbp-demo.tugraz.at/site/software/check-in.html)

[![Build and Test](https://github.com/digital-blueprint/checkin-app/actions/workflows/build-test-publish.yml/badge.svg)](https://github.com/digital-blueprint/checkin-app/actions/workflows/build-test-publish.yml)

A simple location based contact tracing system.
With the possibilities to check in yourself or a guest manually or with an in-build QR-Code scanner.

## Prerequisites

- You need the [API server](https://gitlab.tugraz.at/dbp/relay/dbp-relay-server-template) running
- You need the [DbpRelayCheckinBundle](https://gitlab.tugraz.at/dbp/check-in/dbp-relay-checkin-bundle) to handle
  check-ins to places and contact tracing for warning about COVID-19 cases
- For more information please visit the [Check-in project documentation](https://dbp-demo.tugraz.at/site/software/check-in.html)

## Local development

```bash
# get the source
git clone git@github.com:digital-blueprint/checkin-app.git
cd checkin
git submodule update --init

# install dependencies
yarn install

# constantly build dist/bundle.js and run a local web-server on port 8001 
yarn run watch

# run tests
yarn test
```

Jump to<https://localhost:8001>, so you should get a Single Sign On login page.

## Using this app as pre-built package

### Install app

If you want to install the dbp check-in app in a new folder `check-in-app` with a path prefix `/` you can call:

```bash
npx @digital-blueprint/cli install-app check-in check-in-app /
```

**Warning:** There may be issues when you run these commands as root user, best use a non-root user, like `www-data`.
To do this you can for example open a shell with `runuser -u www-data -- bash`.

Afterwards you can point your Apache web-server to `check-in-app/public`.

Make sure you are allowing `.htaccess` files in your Apache configuration.

Also make sure to add all of your resources you are using (like your API and Keycloak servers) to the
`Content-Security-Policy` in your `check-in-app/public/.htaccess`, so the browser allows access to those sites.

You can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@digital-blueprint/checkin-app/)
for example like this: [dbp-check-in/index.html](https://github.com/digital-blueprint/checkin-app/tree/main/examples/dbp-check-in/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

### Update app

If you want to update the dbp check-in app in the current folder you can call:

```bash
npx @digital-blueprint/cli update-app check-in
```

**Warning:** There may be issues when you run these commands as root user, best use a non-root user, like `www-data`.
To do this you can for example open a shell with `runuser -u www-data -- bash`.

## Activities

This app has the following activities:
- `dbp-check-in-request`
- `dbp-check-out-request`
- `dbp-guest-check-in`
- `dbp-report-risk`

You can find the documentation of these activities in the [check-in activities documentation](https://github.com/digital-blueprint/checkin-app/tree/main/src).

## Adapt app

### Functionality

You can add multiple attributes to the `<dbp-check-in>` tag.

| attribute name | value | Link to description |
|----------------|-------| ------------|
| `provider-root` | Boolean | [appshell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `lang`         | String | [language-select](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/language-select#attributes) | 
| `entry-point-url` | String | [appshell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `keycloak-config` | Object | [appshell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `base-path` | String | [appshell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `src` | String | [appshell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes) |
| `no-welcome-page` | Boolean | [appshell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes)
| `html-overrides` | String | [common](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/common#overriding-slots-in-nested-web-components) |
| `themes` | Array | [theme-switcher](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/theme-switcher#themes-attribute) |
| `darkModeThemeOverride` | String | [theme-switcher](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/theme-switcher#themes-attribute) |
| `search-hash-string` | String | [check-in activities](https://github.com/digital-blueprint/checkin-app/tree/main/src)

#### Mandatory attributes

If you are not using the `provider-root` attribute to "terminate" all provider attributes
you need to manually add these attributes so that the topic will work properly:

```html
<dbp-check-in
    auth
    requested-login-status
    analytics-event
    ...
>
</dbp-check-in>
```

So a working example would be:

```html
<dbp-check-in
    provider-root
    lang="de"
    entry-point-url="http://your.api"
    search-hash-string="unicheckin"
    html-overrides="global-override"
    src="/path/dbp-check-in.topic.metadata.json"
    base-path="/"
    keycloak-config='{"url": "https://keyclock.url/auth", "realm": "your-realm", "clientId": "your-client-id", "silentCheckSsoRedirectUri": "/path/silent-check-sso.html"}'
><dbp-loading-spinner></dbp-loading-spinner>
</dbp-check-in>
```

See [AppShell Attributes](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell#attributes)
for a list of more attributes.

See [Overriding slots in nested web components](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/common#overriding-slots-in-nested-web-components)
for information about how to override slots.

### Design

For frontend design customizations, such as logo, colors, font, favicon, and more, take a look at the [theming documentation](https://dbp-demo.tugraz.at/dev-guide/frontend/theming/).

## "dbp-check-in" slots

These are common slots for the app-shell. You can find the documentation of these slots in the [app-shell documentation](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/main/packages/app-shell).
For the app specific slots take a look at the [check-in activities](https://github.com/digital-blueprint/checkin-app/tree/main/src).

