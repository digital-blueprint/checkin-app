# Check-in Application

[GitLab Repository](https://gitlab.tugraz.at/dbp/check-in/checkin) |
[npmjs package](https://www.npmjs.com/package/@dbp-topics/check-in) |
[Unpkg CDN](https://unpkg.com/browse/@dbp-topics/check-in/)

## Local development

```bash
# get the source
git clone git@gitlab.tugraz.at:dbp/topics/checkin.git
cd checkin
git submodule update --init

# install dependencies
yarn install

# constantly build dist/bundle.js and run a local web-server on port 8001 
yarn run watch

# run tests
yarn test
```

Jump to <https://localhost:8001> and you should get a Single Sign On login page.

## Using this app as pre-built package

Not only you can use this app as pre-built package installed from [npmjs](https://www.npmjs.com/package/@dbp-topics/check-in) via:

```bash
npm install @dbp-topics/check-in
```

But you can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@dbp-topics/check-in/)
for example like this: [dbp-check-in/index.html](https://gitlab.tugraz.at/dbp/check-in/checkin/-/tree/master/examples/dbp-check-in/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

## Activities

### dbp-check-in-request

You can use this activity for checking-in to a location like this:
[dbp-check-in-request/index.html](https://gitlab.tugraz.at/dbp/check-in/checkin/-/tree/master/examples/dbp-check-in-request/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://mw-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider
- `search-hash-string`: String used in the qr code to determine if the qr code has the room information
    - example `search-hash-string="tugrazcheckin"`

### dbp-check-out-request

You can use this activity for checking-out from a location like this:
[dbp-check-out-request/index.html](https://gitlab.tugraz.at/dbp/check-in/checkin/-/tree/master/examples/dbp-check-out-request/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://mw-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider
