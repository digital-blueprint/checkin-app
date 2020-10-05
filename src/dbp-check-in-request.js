import {createI18nInstance} from './i18n.js';
import {css, html, LitElement} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from 'dbp-common/utils';
import {Button, Icon, MiniSpinner} from 'dbp-common';
import * as commonStyles from 'dbp-common/styles';
import {TextSwitch} from './textswitch.js';
import {QrCodeScanner} from 'dbp-qr-code-scanner';

const i18n = createI18nInstance();

class CheckIn extends ScopedElementsMixin(LitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.locationHash = '';
        this.isCheckedIn = false;
        this.identifier = '';
        this.agent = '';
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-button': Button,
          'dbp-textswitch': TextSwitch,
          'dbp-qr-code-scanner': QrCodeScanner,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            locationHash: { type: String, attribute: false },
            isCheckedIn: { type: Boolean, attribute: false}
        };
    }

    connectedCallback() {
        super.connectedCallback();
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    i18n.changeLanguage(this.lang);
                    break;
            }
            super.update(changedProperties);
            // console.log(propName, oldValue);
        });
    }

    async httpGetAsync(url, options)
    {
        let response = await fetch(url, options).then(result => {
            if (!result.ok) throw result;
            return result.json();
        }).catch(error => {
            console.log("fetch error:", error);
        });

        return response;
    }
    
    async doCheckIn(event) {
        let url = event.detail;
        event.stopPropagation();

        if (!this.isCheckedIn) {
            this.locationHash = this.decodeUrl(url);
            console.log(this.locationHash);

            if (this.locationHash.length > 0) {
                let responseData = await this.sendCheckInRequest();
                try {
                    this.parseCheckInInformation(responseData);
                } catch(exception) {
                    console.log("error: returned data cannot be parsed");
                }
            } else {
                console.log('error: location hash is empty');
            }
        }
    }

    decodeUrl(url) {
        console.log(url);
        let params = new URLSearchParams(url);
        return params.get('l');
    }

    parseCheckInInformation(data) {
        this.identifier = data['identifier'];
        this.agent = data['agent'];
        console.log(this.identifier);
        console.log(this.agent);
    }

    async sendCheckInRequest() {
        let response;

        let body = {
            "location": this.locationHash,
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        this.isCheckedIn = true;

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);     

        console.log('response: ', response);

        return response;
    }

    async sendCheckOutRequest() {
        let response;

        let body = {
            "identifier": this.identifier,
            "agent": this.agent,
            "location": this.locationHash,
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        this.isCheckedIn = false;

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_out_actions', options);

        console.log('response: ', response);

        return response;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getNotificationCSS()}

            h2:first-child {
                margin-top: 0;
            }

            h2 {
                margin-bottom: 10px;
            }
        `;
    }

    render() {
        return html`
            <h2>${i18n.t('check-in.title')}</h2>
            <p>${i18n.t('check-in.description')}</p>
            ${!this.isCheckedIn ? html`<dbp-qr-code-scanner lang="${this.lang}" @dbp-qr-code-scanner-url="${(event) => { this.doCheckIn(event);}}"></dbp-qr-code-scanner>` : ``}
            ${this.isCheckedIn ? html`<button class="button is-primary" @click="${this.sendCheckOutRequest}">${i18n.t('check-out.button-text')}</button>` : ``}
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-in-request', CheckIn);
