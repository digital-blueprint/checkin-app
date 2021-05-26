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
