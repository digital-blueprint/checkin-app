# Check-in activities

Here you can find the individual activities of the `check-in` app. If you want to use the whole app look at [check-in](https://github.com/digital-blueprint/checkin-app).

## Usage of an activity

You can use every activity alone. Take a look at our examples [here](https://github.com/digital-blueprint/checkin-app/-/tree/master/examples).

## Activities

### Shared Attributes

These attributes are available for all activities listed here:

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
  - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
  - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
  - example auth property: `{token: "THE_BEARER_TOKEN"}`
  - note: most often this should be an attribute that is not set directly, but subscribed at a provider


### dbp-check-in-request

You can use this activity for checking-in to a location like this:
[dbp-check-in-request/index.html](https://github.com/digital-blueprint/checkin-app/-/tree/master/examples/dbp-check-in-request/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `search-hash-string`: String used in the qr code to determine if the qr code has the room information
    - example `search-hash-string="tugrazcheckin"`

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### additional-information

The content of this slot will be shown below the other text and can be used to provide
further information about the check-in process. For example a link to a page with the
data protection declaration can be provided.

Example:

```html
<dbp-check-in-request lang="de">
  <template slot="additional-information">
    <dbp-translated subscribe="lang">
      <div slot="de">
        Sollten Sie als COVID-19-Verdachts- oder -Erkrankungsfall gelten, melden Sie sich bitte umgehend bei email@email.com.
      </div>
      <div slot="en">
        If you are a suspected COVID-19 case or a case of illness, please report this immediately to email@email.com.
      </div>
    </dbp-translated>
  </template>
</dbp-check-in-request>
```

### dbp-check-out-request

You can use this activity for checking-out from a location like this:
[dbp-check-out-request/index.html](https://github.com/digital-blueprint/checkin-app/-/tree/master/examples/dbp-check-out-request/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

See [shared attributes](#shared-attributes).

### dbp-guest-check-in

You can use this activity for checking-in guests to a location like this:
[dbp-guest-check-in/index.html](https://github.com/digital-blueprint/checkin-app/-/tree/master/examples/dbp-guest-check-in/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

See [shared attributes](#shared-attributes).

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
      Melden Sie einen Gast ohne Universitäts-Account an einem Ort für die Dauer seines Besuchs an. Die Abmeldung erfolgt automatisch an dem angegebenen Zeitpunkt. Im Risikofall wird der Gast von der Universität per E-Mail kontaktiert.
      <br>
      <br>
      Mit der Anmeldung bestätige ich, dass ich dem von mir angemeldeten Gast die Datenschutzerklärung zur App "dbp check-in" zur Kenntnis gebracht habe. <br>
      <a target="_blank" class="int-link-internal" href="<%= getPrivateUrl('datenschutzerklaerung-check-in.pdf') %>" title="Zur Datenschutzerklärung">
        <span>Zur Datenschutzerklärung </span>
      </a>
    </p>
  </div>
  <div slot="en">
    <p>
      Melden Sie einen Gast ohne Universitäts-Account an einem Ort für die Dauer seines Besuchs an. Die Abmeldung erfolgt automatisch an dem angegebenen Zeitpunkt. Im Risikofall wird der Gast von der Universität per E-Mail kontaktiert.
      <br>
      <br>
      Check in a guest without a university account at a location for the duration of their visit. The check out takes place automatically at the specified time. In the event of a risk, the guest will be contacted by the university by email.<br>
      <a target="_blank" class="int-link-internal" href="<%= getPrivateUrl('datenschutzerklaerung-check-in.pdf') %>" title="Privacy statement">
        <span>Privacy statement </span>
      </a>
    </p>
  </div>
  </dbp-translated>
</dbp-report-risk>
```


### dbp-report-risk

This is an information page on how to report a risk of infection. You can use it like this:
[dbp-report-risk/index.html](https://github.com/digital-blueprint/checkin-app/-/tree/master/examples/dbp-report-risk/index.html)

#### Attributes

See [shared attributes](#shared-attributes).

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

## Design Note

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
