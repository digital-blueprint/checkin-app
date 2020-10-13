import {createI18nInstance} from './i18n.js';
import {css, html, LitElement} from 'lit-element';
import DBPCheckInLitElement from "./dbp-check-in-lit-element";
import {classMap} from 'lit-html/directives/class-map.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from 'dbp-common/utils';
import {Button, EventBus, Icon, MiniSpinner} from 'dbp-common';
import * as commonStyles from 'dbp-common/styles';
import {TextSwitch} from './textswitch.js';

const i18n = createI18nInstance();

class CheckOut extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.activeCheckins = [];
        this.isRequested = false;
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
            activeCheckins: { type: Array, attribute: false },
            isRequested: { type: Boolean, attribute: false },
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginStatus = '';
        this._loginState = [];
        this._bus = new EventBus();
        this._updateAuth = this._updateAuth.bind(this);
        this._bus.subscribe('auth-update', this._updateAuth);
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    i18n.changeLanguage(this.lang);
                    break;
            }
           
            // console.log(propName, oldValue);
        });

        super.update(changedProperties);
    }

    _updateAuth(e) {
        this._loginStatus = e.status;
        // Every time isLoggedIn()/isLoading() return something different we request a re-render
        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
    }

    disconnectedCallback() {
        this._bus.close();

        super.disconnectedCallback();
    }

    isLoggedIn() {
        return (window.DBPPerson !== undefined && window.DBPPerson !== null);
    }

    isLoading() {
        if (this._loginStatus === "logged-out")
            return false;
        return (!this.isLoggedIn() && window.DBPAuthToken !== undefined);
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

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);
        
        //console.log('response: ', response);
        return response;
    }

    async doCheckOut(event, entry) {
        let response = await this.sendCheckOutRequest(entry);
        console.log(response);

        this.removeEntryFromArray(this.activeCheckins, entry);
        console.log('active checks: ', this.activeCheckins);
        this.requestUpdate(); //TODO fix
    }

    async sendCheckOutRequest(entry) {
        let locationHash = entry['location']['identifier'];
        let seatNr = entry['seatNumber'];
        //TODO check if values are set, otherwise skip request -> error message

        let body = {
            "location": "/check_in_places/" + locationHash,
            "seatNumber": parseInt(seatNr),
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        let response = await this.httpGetAsync(this.entryPointUrl + '/location_check_out_actions', options);

        return response;
    }

    removeEntryFromArray(array, entry) {
        let index = array.indexOf(entry);
        return array.splice(index, 1);
    }

    parseActiveCheckins(response) {
        let list = [];

        let numTypes = parseInt(response['hydra:totalItems']);
        if (isNaN(numTypes)) {
            numTypes = 0;
        }

        for (let i = 0; i < numTypes; i++ ) {
            list[i] = response['hydra:member'][i];
        }

        return list;
    }

    async getListOfActiveCheckins() {
        if (this.isLoggedIn() && !this.isRequested) {
            let response = await this.requestActiveCheckins();
            console.log(response);

            if (response !== undefined && response.status !== 403) {
                this.activeCheckins = this.parseActiveCheckins(response);
                console.log('active checkins: ', this.activeCheckins);
            }
            this.isRequested = true;
        }
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

            .checkins {
                display: grid;
                grid-template-columns: repeat(3, max-content);
                column-gap: 15px;
                row-gap: 1.5em;
                align-items: center;
                margin-top: 2em;
                margin-bottom: 2em;
            }

            .header {
                display: grid;
                align-items: center;
            }
        `;
    }

    render() {

        if (this.isLoggedIn() && !this.isLoading()) {
            this.getListOfActiveCheckins(); 
        }
        
        return html`
            <h2>${i18n.t('check-out.title')}</h2>
            <p>${i18n.t('check-out.description')}</p>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                <div class="checkins">
                    ${this.activeCheckins.map(i => html`

                    <span class="header"><strong>${i.location.name}</strong>Sitzplatz: ${i.seatNumber}</span>
                    <button id="btn-${i.location.identifier}" class="button is-primary" @click="${(event) => { this.doCheckOut(event, i); }}">${i18n.t('check-out.button-text')}</button>
                    <button class="button">${i18n.t('check-in.refresh-button-text')}</button>`)} <!-- //TODO -->

                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-out-request', CheckOut);
