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

### Install app

If you want to install the DBP Check-in App in a new folder `check-in-app` with a path prefix `/` you can call:

```bash
npx @digital-blueprint/cli install-app check-in check-in-app /
```

Afterwards you can point your Apache web-server to `check-in-app/public`.

Make sure you are allowing `.htaccess` files in your Apache configuration.

Also make sure to add all of your resources you are using (like your API and Keycloak servers) to the
`Content-Security-Policy` in your `check-in-app/public/.htaccess`, so the browser allows access to those sites.

You can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@dbp-topics/check-in/)
for example like this: [dbp-check-in/index.html](https://gitlab.tugraz.at/dbp/check-in/checkin/-/tree/master/examples/dbp-check-in/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

### Update app

If you want to update the DBP Check-in App in the current folder you can call:

```bash
npx @digital-blueprint/cli update-app check-in
```

## Activities

### dbp-check-in-request

You can use this activity for checking-in to a location like this:
[dbp-check-in-request/index.html](https://gitlab.tugraz.at/dbp/check-in/checkin/-/tree/master/examples/dbp-check-in-request/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider
- `search-hash-string`: String used in the qr code to determine if the qr code has the room information
    - example `search-hash-string="tugrazcheckin"`

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### additional-information

The content of this slot will be shown below the other text and can be used to provide
further information about the check-in process. For example a link to a page with the
data protection declaration can be provided.

### dbp-check-out-request

You can use this activity for checking-out from a location like this:
[dbp-check-out-request/index.html](https://gitlab.tugraz.at/dbp/check-in/checkin/-/tree/master/examples/dbp-check-out-request/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider

### dbp-guest-check-in

You can use this activity for checking-in guests to a location like this:
[dbp-guest-check-in/index.html](https://gitlab.tugraz.at/dbp/check-in/checkin/-/tree/master/examples/dbp-guest-check-in/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### activity-description

The content of this slot will be shown after the headline and can be used to provide
further information about the process to checkin an university external person. For example a link to a page with
more information about how to report a risk can be provided.

Example:

```html
<dbp-report-risk lang="de">
  dbp-translated subscribe="lang">
  <div slot="de">
    <p>
      Melden Sie einen Gast ohne TU Graz-Account an einem Ort für die Dauer seines Besuchs an. Die Abmeldung erfolgt automatisch an dem angegebenen Zeitpunkt. Im Risikofall wird der Gast von der TU Graz per E-Mail kontaktiert.
      <br>
      <br>
      Mit der Anmeldung bestätige ich, dass ich dem von mir angemeldeten Gast die Datenschutzerklärung zur App "TU Graz check-in" zur Kenntnis gebracht habe. <br>
      <a target="_blank" class="int-link-internal" href="<%= getPrivateUrl('datenschutzerklaerung-tu-graz-check-in.pdf') %>" title="Zur Datenschutzerklärung">
        <span>Zur Datenschutzerklärung </span>
      </a>
    </p>
  </div>
  <div slot="en">
    <p>
      Melden Sie einen Gast ohne TU Graz-Account an einem Ort für die Dauer seines Besuchs an. Die Abmeldung erfolgt automatisch an dem angegebenen Zeitpunkt. Im Risikofall wird der Gast von der TU Graz per E-Mail kontaktiert.
      <br>
      <br>
      Check in a guest without a TU Graz account at a location for the duration of their visit. The check out takes place automatically at the specified time. In the event of a risk, the guest will be contacted by TU Graz by email.<br>
      <a target="_blank" class="int-link-internal" href="<%= getPrivateUrl('datenschutzerklaerung-tu-graz-check-in.pdf') %>" title="Privacy statement">
        <span>Privacy statement </span>
      </a>
    </p>
  </div>
  </dbp-translated>
</dbp-report-risk>
```


### dbp-report-risk

This is an information page on how to report a risk of infection. You can use it like this:
[dbp-report-risk/index.html](https://gitlab.tugraz.at/dbp/check-in/checkin/-/tree/master/examples/dbp-report-risk/index.html)

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### additional-information

The content of this slot will be shown below the other text and can be used to provide
further information about the process to report a risk. For example a link to a page with
more information about how to report a risk can be provided.

Example:

```html
<dbp-report-risk lang="de">
  <template slot="additional-information">
    <dbp-translated subscribe="lang">
      <div slot="de">
        Sollten Sie als COVID-19-Verdachts- oder -Erkrankungsfall gelten, melden Sie sich bitte umgehend bei
        <a target="_blank" href="mailto:your@email.address">your@email.address</a>!
      </div>
      <div slot="en">
        If you are a suspected COVID-19 case or a case of illness, please report this immediately to
        <a target="_blank" href="mailto:your@email.address">your@email.address</a>!
      </div>
    </dbp-translated>
  </template>
</dbp-report-risk>
```

### Design Note

To ensure a uniform and responsive design these activities should occupy 100% width of the window when the activities width are under 768 px.

## Mandatory attributes

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

See [AppShell Attributes](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/app-shell#attributes)
for a list of more attributes.

See [Overriding slots in nested web components](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/common#overriding-slots-in-nested-web-components)
for information about how to override slots.
