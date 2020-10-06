import {createI18nInstance} from './i18n.js';
import {css, html, LitElement} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from 'dbp-common/utils';
import {Button, Icon, MiniSpinner} from 'dbp-common';
import * as commonStyles from 'dbp-common/styles';
import {TextSwitch} from './textswitch.js';

const i18n = createI18nInstance();

class CheckOut extends ScopedElementsMixin(LitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-button': Button,
          'dbp-textswitch': TextSwitch,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
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

    async requestActiveCheckins() {
        let response;

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_places', options); //TODO change to correct entrypoint
        
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

    getListOfActiveCheckins() {
        let list = [];
        
        let response = this.requestActiveCheckins();
        console.log(response); //TODO parse response

        return list;
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
            <h2>${i18n.t('check-out.title')}</h2>
            <p>${i18n.t('check-out.description')}</p>
            ${this.getListOfActiveCheckins().map(i => html`<span class="header"><strong>${i}</strong></span>
                <button id="btn-${i}" class="button is-primary" @click="${this.sendCheckOutRequest}">${i18n.t('check-out.button-text')}</button>`)}
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-out-request', CheckOut);
